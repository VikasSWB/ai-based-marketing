

from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth.models import User
from .models import Order
from django.db.models import Count, Sum, Avg
from django.db.models.functions import TruncMonth, TruncDay, ExtractYear, ExtractMonth
import pandas as pd
import numpy as np
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Max, Min, Avg, F, ExpressionWrapper, DurationField
from django.utils.timezone import now
from .ml_utils import load_rfm_segments, load_churn_model_and_scaler, predict_churn
import pytz
from django.conf import settings
import os
import json
from django.http import HttpResponse

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@login_required(login_url='/signin/')
def dashboard_view(request):
    # Get today's date and yesterday's date
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    # 1. Today Customers (distinct customer_email for today)
    today_customers = Order.objects.filter(order_date__date=today).values('customer_email').distinct().count()
    yesterday_customers = Order.objects.filter(order_date__date=yesterday).values('customer_email').distinct().count()
    customers_change = ((today_customers - yesterday_customers) / (yesterday_customers or 1)) * 100 if yesterday_customers else 100

    # 2. Today Products (sum of product_quantity for today)
    today_products = Order.objects.filter(order_date__date=today).aggregate(total=Sum('product_quantity'))['total'] or 0
    yesterday_products = Order.objects.filter(order_date__date=yesterday).aggregate(total=Sum('product_quantity'))['total'] or 0
    products_change = ((today_products - yesterday_products) / (yesterday_products or 1)) * 100 if yesterday_products else 100

    # 3. Total Orders (all-time)
    total_orders = Order.objects.count()
    yesterday_orders = Order.objects.filter(order_date__date=yesterday).count()
    orders_change = ((total_orders - yesterday_orders) / (yesterday_orders or 1)) * 100 if yesterday_orders else 100

    # 4. Total Revenue (sum of order_total)
    total_revenue = Order.objects.aggregate(total=Sum('order_total'))['total'] or 0
    yesterday_revenue = Order.objects.filter(order_date__date=yesterday).aggregate(total=Sum('order_total'))['total'] or 0
    revenue_change = ((total_revenue - yesterday_revenue) / (yesterday_revenue or 1)) * 100 if yesterday_revenue else 100

    # 5. Recent Orders (3 most recent)
    recent_orders = Order.objects.order_by('-order_date')[:3]

    # 6. Top Products by Sales (top 5 by product_row_total)
    top_products = (Order.objects.values('product_name')
                   .annotate(total_sales=Sum('product_row_total'), total_quantity=Sum('product_quantity'))
                   .order_by('-total_sales')[:5])

    # 7. Discount Usage Overview
    total_discount = Order.objects.aggregate(total=Sum('order_discount'))['total'] or 0
    orders_with_coupon = Order.objects.filter(coupon_code__isnull=False).count()

    context = {
        'today_customers': today_customers,
        'customers_change': customers_change,
        'today_products': today_products,
        'products_change': products_change,
        'total_orders': total_orders,
        'orders_change': orders_change,
        'total_revenue': total_revenue,
        'revenue_change': revenue_change,
        'recent_orders': recent_orders,
        'top_products': top_products,
        'total_discount': total_discount,
        'orders_with_coupon': orders_with_coupon,
    }
    return render(request, 'dashboard/dashboard.html', context)

@login_required(login_url='/signin/')
def customer_insights_view(request):
    # Customer Details Table: Group by customer_email, calculate total orders and total spend
    customer_details = (Order.objects.values('customer_email', 'customer_name')
                       .annotate(total_orders=Count('order_id'), total_spend=Sum('order_total'))
                       .order_by('-total_spend'))

    context = {
        'customer_details': customer_details,
    }
    return render(request, 'dashboard/customer_insights.html', context)

@login_required(login_url='/signin/')
def financial_insights_view(request):
    return render(request, 'dashboard/financial_insights.html')

@login_required(login_url='/signin/')
def product_insights_view(request):
    return render(request, 'dashboard/product_insights.html')

@login_required(login_url='/signin/')
def eda_charts_view(request):
    return render(request, 'dashboard/eda_charts.html')

@login_required(login_url='/signin/')
def rfm_analysis_view(request):
    return render(request, 'dashboard/rfm_analysis.html')


def chart_data(request):
    try:
        # Get query parameters
        selected_month = request.GET.get('month', '')  # e.g., '2023-01'
        date_range_option = request.GET.get('date_range_option', 'last_1_year')
        start_date_str = request.GET.get('start_date', None)
        end_date_str = request.GET.get('end_date', None)

        # Determine the date range
        today = timezone.now().date()

        # Parse start_date and end_date if provided
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        else:
            # Default date range based on date_range_option
            if date_range_option == 'last_1_year':
                start_date = today - timezone.timedelta(days=365)
                end_date = today
            else:  # 'all' or any other value
                earliest_order = Order.objects.earliest('order_date')
                start_date = earliest_order.order_date.date() if earliest_order else today
                end_date = today

        # Ensure start_date is not after end_date
        if start_date > end_date:
            return JsonResponse({'error': 'Start date must be before end date.'}, status=400)

        # Adjust start_date to the first day of the month for consistency
        start_date = start_date.replace(day=1)

        # Fetch orders filtered by date range
        orders = Order.objects.filter(order_date__date__gte=start_date, order_date__date__lte=end_date)
        if not orders.exists():
            logger.error("No orders found in the database within the specified date range.")
            return JsonResponse({'error': 'No orders found in the database within the specified date range.'}, status=400)

        # Convert to DataFrame for easier manipulation
        df = pd.DataFrame(list(orders.values()))
        logger.debug(f"DataFrame shape: {df.shape}")

        # Get available months and years for the dropdown (unfiltered by date to ensure all options are available)
        available_months = (Order.objects.annotate(
            year=ExtractYear('order_date'),
            month=ExtractMonth('order_date')
        ).values('year', 'month').distinct().order_by('year', 'month'))
        month_options = [f"{m['year']}-{str(m['month']).zfill(2)}" for m in available_months]

        # 1. Distribution of Order Totals (Bin the data)
        if 'order_total' not in df.columns or df['order_total'].empty:
            logger.error("order_total column is missing or empty.")
            hist_labels, hist_values = [], []
        else:
            order_totals = df['order_total'].dropna().astype(float).to_numpy()
            if len(order_totals) == 0:
                logger.warning("No valid order_totals after dropping NaN.")
                hist_labels, hist_values = [], []
            else:
                hist, bin_edges = np.histogram(order_totals, bins=30)
                hist_labels = [f"{int(bin_edges[i])}-{int(bin_edges[i+1])}" for i in range(len(bin_edges)-1)]
                hist_values = hist.tolist()
                logger.debug(f"Order Totals Histogram - Labels: {hist_labels[:5]}, Values: {hist_values[:5]}")

        # 2. Trend of Orders Over Time (with month filter)
        if selected_month:
            try:
                year, month = map(int, selected_month.split('-'))
                if not (1 <= month <= 12) or year < 1900 or year > 9999:
                    logger.error(f"Invalid year or month: {selected_month}")
                    return JsonResponse({'error': 'Invalid year or month format.'}, status=400)
                monthly_orders = (Order.objects.filter(
                    order_date__year=year,
                    order_date__month=month,
                    order_date__date__gte=start_date,
                    order_date__date__lte=end_date
                ).annotate(month=TruncMonth('order_date'))
                 .values('month')
                 .annotate(count=Count('order_id'))
                 .order_by('month'))
            except (ValueError, TypeError) as e:
                logger.error(f"Invalid month format: {selected_month}, Error: {str(e)}")
                return JsonResponse({'error': 'Invalid month format. Use YYYY-MM.'}, status=400)
        else:
            monthly_orders = (Order.objects.filter(
                order_date__date__gte=start_date,
                order_date__date__lte=end_date
            ).annotate(month=TruncMonth('order_date'))
             .values('month')
             .annotate(count=Count('order_id'))
             .order_by('month'))
        months = [mo['month'].strftime('%Y-%m') for mo in monthly_orders] if monthly_orders else []
        order_counts = [mo['count'] for mo in monthly_orders] if monthly_orders else []
        logger.debug(f"Months: {months[:5]}, Order Counts: {order_counts[:5]}")

        # 3. Boxplot of Order Totals by Order Status (approximated as grouped bar)
        if 'order_status' not in df.columns:
            logger.error("order_status column is missing.")
            statuses, means, mins, maxs = [], [], [], []
        else:
            status_totals = (df.groupby('order_status')['order_total']
                            .agg(['mean', 'min', 'max']).reset_index())
            statuses = status_totals['order_status'].tolist()
            means = status_totals['mean'].astype(float).tolist()
            mins = status_totals['min'].astype(float).tolist()
            maxs = status_totals['max'].astype(float).tolist()
            logger.debug(f"Statuses: {statuses}, Means: {means}")

        # 4. Scatter Plot: Order Total vs. Product Quantity
        if 'product_quantity' not in df.columns:
            logger.error("product_quantity column is missing.")
            quantities, order_totals_list = [], []
        else:
            quantities = df['product_quantity'].dropna().astype(int).tolist()
            order_totals_list = df['order_total'].dropna().astype(float).tolist()
            logger.debug(f"Quantities: {quantities[:5]}, Order Totals: {order_totals_list[:5]}")

        # 5. Correlation Heatmap (approximated as bar chart of correlations)
        num_cols = ['order_total', 'product_quantity']
        if not all(col in df.columns for col in num_cols):
            logger.error("Missing numeric columns for correlation.")
            corr, corr_labels = [], []
        else:
            corr = df[num_cols].corr().values.flatten().tolist()[1:-1]
            corr_labels = ['order_total vs product_quantity']
            logger.debug(f"Correlation: {corr}")

        # RFM Analysis
        if 'customer_email' not in df.columns:
            logger.error("customer_email column is missing.")
            rfm = pd.DataFrame()
        else:
            rfm = (df.groupby('customer_email')
                   .agg({'order_date': ['min', 'max', 'count'], 'order_total': 'sum'})
                   .reset_index())
            rfm.columns = ['customer_email', 'first_order_date', 'last_order_date', 'frequency', 'monetary']
            reference_date = df['order_date'].max() + pd.Timedelta(days=1)
            rfm['recency'] = (reference_date - rfm['last_order_date']).dt.days
            churn_threshold = 180
            rfm['churn'] = (rfm['recency'] > churn_threshold).astype(int)
            logger.debug(f"RFM DataFrame shape: {rfm.shape}")

        # 6. Recency Distribution (Bin the data)
        if 'recency' not in rfm.columns or rfm['recency'].empty:
            logger.error("recency column is missing or empty.")
            recency_hist_labels, recency_hist_values = [], []
        else:
            recency = rfm['recency'].dropna().astype(float).to_numpy()
            if len(recency) == 0:
                logger.warning("No valid recency values after dropping NaN.")
                recency_hist_labels, recency_hist_values = [], []
            else:
                recency_hist, recency_bin_edges = np.histogram(recency, bins=20)
                recency_hist_labels = [f"{int(recency_bin_edges[i])}-{int(recency_bin_edges[i+1])}" for i in range(len(recency_bin_edges)-1)]
                recency_hist_values = recency_hist.tolist()
                logger.debug(f"Recency Histogram - Labels: {recency_hist_labels[:5]}, Values: {recency_hist_values[:5]}")

        # 7. Frequency Distribution (Bin the data)
        if 'frequency' not in rfm.columns or rfm['frequency'].empty:
            logger.error("frequency column is missing or empty.")
            freq_hist_labels, freq_hist_values = [], []
        else:
            frequency = rfm['frequency'].dropna().astype(float).to_numpy()
            if len(frequency) == 0:
                logger.warning("No valid frequency values after dropping NaN.")
                freq_hist_labels, freq_hist_values = [], []
            else:
                freq_hist, freq_bin_edges = np.histogram(frequency, bins=20)
                freq_hist_labels = [f"{int(freq_bin_edges[i])}-{int(freq_bin_edges[i+1])}" for i in range(len(freq_bin_edges)-1)]
                freq_hist_values = freq_hist.tolist()
                logger.debug(f"Frequency Histogram - Labels: {freq_hist_labels[:5]}, Values: {freq_hist_values[:5]}")

        # 8. Monetary Distribution (Bin the data)
        if 'monetary' not in rfm.columns or rfm['monetary'].empty:
            logger.error("monetary column is missing or empty.")
            monetary_hist_labels, monetary_hist_values = [], []
        else:
            monetary = rfm['monetary'].dropna().astype(float).to_numpy()
            if len(monetary) == 0:
                logger.warning("No valid monetary values after dropping NaN.")
                monetary_hist_labels, monetary_hist_values = [], []
            else:
                monetary_hist, monetary_bin_edges = np.histogram(monetary, bins=20)
                monetary_hist_labels = [f"{int(monetary_bin_edges[i])}-{int(monetary_bin_edges[i+1])}" for i in range(len(monetary_bin_edges)-1)]
                monetary_hist_values = monetary_hist.tolist()
                logger.debug(f"Monetary Histogram - Labels: {monetary_hist_labels[:5]}, Values: {monetary_hist_values[:5]}")

        # 9. Frequency by Churn Status
        churn_freq = rfm.groupby('churn')['frequency'].mean().tolist()
        logger.debug(f"Churn Frequency: {churn_freq}")

        # 10. Monetary by Churn Status
        churn_monetary = rfm.groupby('churn')['monetary'].mean().tolist()
        logger.debug(f"Churn Monetary: {churn_monetary}")

        # 11. Recency vs. Monetary with Churn Highlight
        recency_scatter = rfm['recency'].tolist()
        monetary_scatter = rfm['monetary'].tolist()
        churn_scatter = rfm['churn'].tolist()
        logger.debug(f"Recency Scatter: {recency_scatter[:5]}, Monetary Scatter: {monetary_scatter[:5]}")

        data = {
            'month_options': month_options,
            'hist_labels': hist_labels,
            'hist_values': hist_values,
            'months': months,
            'order_counts': order_counts,
            'statuses': statuses,
            'means': means,
            'mins': mins,
            'maxs': maxs,
            'quantities': quantities,
            'order_totals': order_totals_list,
            'corr': corr,
            'corr_labels': corr_labels,
            'recency_hist_labels': recency_hist_labels,
            'recency_hist_values': recency_hist_values,
            'freq_hist_labels': freq_hist_labels,
            'freq_hist_values': freq_hist_values,
            'monetary_hist_labels': monetary_hist_labels,
            'monetary_hist_values': monetary_hist_values,
            'churn_freq': churn_freq,
            'churn_monetary': churn_monetary,
            'recency_scatter': recency_scatter,
            'monetary_scatter': monetary_scatter,
            'churn_scatter': churn_scatter,
        }
        return JsonResponse(data, safe=False)

    except Exception as e:
        logger.error(f"Error in chart_data: {str(e)}")
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)


def dashboard_data(request):
    try:
        # 1. Website Views (orders per day over the last 7 days)
        today = timezone.now().date()
        seven_days_ago = today - timedelta(days=6)
        daily_orders = (Order.objects.filter(order_date__date__gte=seven_days_ago)
                       .annotate(day=TruncDay('order_date'))
                       .values('day')
                       .annotate(count=Count('order_id'))
                       .order_by('day'))
        days = []
        order_counts = []
        current_date = seven_days_ago
        while current_date <= today:
            days.append(current_date.strftime('%a'))
            count = next((item['count'] for item in daily_orders if item['day'].date() == current_date), 0)
            order_counts.append(count)
            current_date += timedelta(days=1)

        # 2. Daily Sales (revenue over the last 9 months)
        nine_months_ago = today - timedelta(days=270)  # Approx 9 months
        monthly_revenue = (Order.objects.filter(order_date__date__gte=nine_months_ago)
                          .annotate(month=TruncMonth('order_date'))
                          .values('month')
                          .annotate(total=Sum('order_total'))
                          .order_by('month'))
        months = []
        revenues = []
        current_month = nine_months_ago.replace(day=1)
        while current_month <= today:
            months.append(current_month.strftime('%b'))
            revenue = next((item['total'] for item in monthly_revenue if item['month'].date() == current_month), 0)
            revenues.append(float(revenue) if revenue else 0)
            # Move to the next month
            current_month = (current_month + timedelta(days=32)).replace(day=1)

        # 3. Order Status Breakdown (average order total by status)
        status_totals = (Order.objects.values('order_status')
                        .annotate(avg_total=Avg('order_total'))
                        .order_by('order_status'))
        statuses = [item['order_status'] for item in status_totals]
        avg_totals = [float(item['avg_total']) if item['avg_total'] else 0 for item in status_totals]

        # 4. Revenue by Payment Method
        payment_revenue = (Order.objects.values('payment_method')
                          .annotate(total_revenue=Sum('order_total'))
                          .order_by('payment_method'))
        payment_methods = [item['payment_method'] for item in payment_revenue]
        payment_totals = [float(item['total_revenue']) if item['total_revenue'] else 0 for item in payment_revenue]

        # 5. Average Order Value by Customer (top 10 customers by avg order value)
        avg_order_value = (Order.objects.values('customer_email')
                          .annotate(avg_order=Avg('order_total'))
                          .order_by('-avg_order')[:10])  # Limit to top 10 for better visualization
        customer_emails = [item['customer_email'] for item in avg_order_value]
        avg_values = [float(item['avg_order']) if item['avg_order'] else 0 for item in avg_order_value]

        # 6. Payment Method Popularity (count of orders by payment method)
        payment_popularity = (Order.objects.values('payment_method')
                             .annotate(order_count=Count('order_id'))
                             .order_by('-order_count'))
        payment_methods_pop = [item['payment_method'] for item in payment_popularity]
        order_counts_payment = [item['order_count'] for item in payment_popularity]

        data = {
            'days': days,
            'order_counts': order_counts,
            'months': months,
            'revenues': revenues,
            'statuses': statuses,
            'avg_totals': avg_totals,
            'payment_methods': payment_methods,
            'payment_totals': payment_totals,
            'customer_emails': customer_emails,
            'avg_values': avg_values,
            'payment_methods_pop': payment_methods_pop,
            'order_counts_payment': order_counts_payment,
        }
        return JsonResponse(data, safe=False)

    except Exception as e:
        logger.error(f"Error in dashboard_data: {str(e)}")
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)

@login_required
def customer_insights_data(request):
    """
    API endpoint to provide data for customer insights visualizations.
    """
    try:
        logger.info("Fetching customer insights data...")

        # Get query parameters for range filtering, date range, and pagination
        min_orders = int(request.GET.get('min_orders', 0))
        max_orders = request.GET.get('max_orders', None)  # None means no upper limit
        start_date = request.GET.get('start_date', None)
        end_date = request.GET.get('end_date', None)
        date_range_option = request.GET.get('date_range_option', 'last_1_year')  # Default to last 1 year
        page = int(request.GET.get('page', 1))
        items_per_page = 20

        # 1. Top Customers by Total Orders (top 10 customers by number of orders)
        # Apply date range filter to the orders used for top customers
        top_customers_query = (Order.objects.values('customer_name', 'customer_email')
                              .annotate(total_orders=Count('order_id')))
        
        if start_date and end_date:
            start_date = pd.to_datetime(start_date).tz_localize('UTC')
            end_date = pd.to_datetime(end_date).tz_localize('UTC')
            top_customers_query = top_customers_query.filter(order_date__gte=start_date, order_date__lte=end_date)
        elif date_range_option != 'all':
            # Default to the most recent 1 year (April 2024 to April 2025)
            end_date = pd.to_datetime('2025-04-02').tz_localize('UTC')  # Current date
            start_date = end_date - pd.Timedelta(days=365)  # 1 year ago
            top_customers_query = top_customers_query.filter(order_date__gte=start_date, order_date__lte=end_date)

        top_customers = top_customers_query.order_by('-total_orders')[:10]
        customer_names = [item['customer_name'] for item in top_customers]
        total_orders = [item['total_orders'] for item in top_customers]
        logger.debug(f"Top Customers Data: {list(top_customers)}")

        # 2. Customer Order Trend Over Time (total orders per month)
        orders_over_time_query = (Order.objects
                                 .annotate(month=TruncMonth('order_date'))
                                 .values('month')
                                 .annotate(total_orders=Count('order_id'))
                                 .order_by('month'))

        # Apply date range filter to orders_over_time
        if start_date and end_date:
            orders_over_time_query = orders_over_time_query.filter(order_date__gte=start_date, order_date__lte=end_date)
        elif date_range_option != 'all':
            orders_over_time_query = orders_over_time_query.filter(order_date__gte=start_date, order_date__lte=end_date)

        orders_over_time = list(orders_over_time_query)

        # Generate a list of months and order counts, filling in gaps with zeros
        earliest_order = Order.objects.earliest('order_date')
        earliest_date = earliest_order.order_date.date() if earliest_order else timezone.now().date()
        today = timezone.now().date()
        earliest_month = earliest_date.replace(day=1)

        # Adjust the timeline based on the date range
        if start_date and end_date:
            timeline_start = start_date.date().replace(day=1)
            timeline_end = end_date.date().replace(day=1)
        elif date_range_option == 'all':
            timeline_start = earliest_month
            timeline_end = today.replace(day=1)
        else:
            timeline_start = start_date.date().replace(day=1)
            timeline_end = end_date.date().replace(day=1)

        order_months = []
        order_values = []
        current_month = timeline_start
        while current_month <= timeline_end:
            order_months.append(current_month.strftime('%Y-%m'))
            order_value = next((item['total_orders'] for item in orders_over_time if item['month'].date() == current_month), 0)
            order_values.append(order_value)
            current_month = (current_month + timedelta(days=32)).replace(day=1)
        logger.debug(f"Order Trend Data: Months={order_months}, Values={order_values}")

        # 3. Customer Details Table (group by customer, count total orders, filter by range, paginate)
        customer_details_query = (Order.objects.values('customer_name', 'customer_email')
                                .annotate(total_orders=Count('order_id'))
                                .order_by('-total_orders'))

        # Apply date range filter to customer details
        if start_date and end_date:
            customer_details_query = customer_details_query.filter(order_date__gte=start_date, order_date__lte=end_date)
        elif date_range_option != 'all':
            customer_details_query = customer_details_query.filter(order_date__gte=start_date, order_date__lte=end_date)

        # Apply range filtering for total orders
        if max_orders is not None:
            max_orders = int(max_orders)
            customer_details_query = customer_details_query.filter(total_orders__gte=min_orders, total_orders__lt=max_orders)
        else:
            customer_details_query = customer_details_query.filter(total_orders__gte=min_orders)

        # Get total count for pagination
        total_customers = customer_details_query.count()
        total_pages = (total_customers + items_per_page - 1) // items_per_page  # Ceiling division

        # Apply pagination
        start_index = (page - 1) * items_per_page
        end_index = start_index + items_per_page
        customer_details = customer_details_query[start_index:end_index]
        customer_details_list = list(customer_details)
        logger.debug(f"Customer Details Data: Page={page}, Range={min_orders}-{max_orders}, Data={customer_details_list}")

        # 4. Calculate order ranges for the dropdown
        max_customer_orders = (Order.objects.values('customer_name')
                             .annotate(total_orders=Count('order_id'))
                             .order_by('-total_orders')
                             .first())
        max_orders_value = max_customer_orders['total_orders'] if max_customer_orders else 0
        order_ranges = []
        step = 20
        for i in range(0, max_orders_value + step, step):
            range_start = i
            range_end = i + step
            order_ranges.append({'min': range_start, 'max': range_end})
        logger.debug(f"Order Ranges: {order_ranges}")

        data = {
            'customer_names': customer_names,
            'total_orders': total_orders,
            'order_months': order_months,
            'order_values': order_values,
            'customer_details': customer_details_list,
            'total_pages': total_pages,
            'current_page': page,
            'order_ranges': order_ranges,
        }
        logger.info("Customer insights data fetched successfully.")
        return JsonResponse(data, safe=False)

    except Exception as e:
        logger.error(f"Error in customer_insights_data: {str(e)}", exc_info=True)
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)
    
def customer_insights(request):
    return render(request, 'dashboard/customer_insights.html')
    
@login_required
def cohort_data(request):
    """
    API endpoint to provide data for cohort analysis visualizations with revenue over 12 months.
    """
    try:
        logger.info("Fetching cohort analysis data...")

        # Get query parameters for date range and pagination
        start_date = request.GET.get('start_date', None)
        end_date = request.GET.get('end_date', None)
        date_range_option = request.GET.get('date_range_option', 'last_1_year')  # Default to last 1 year
        page = int(request.GET.get('page', 1))
        items_per_page = 10  # Number of cohorts per page for the metrics table

        # Determine the date range
        today = timezone.now().date()

        if start_date and end_date:
            try:
                start_date = pd.to_datetime(start_date).tz_localize('UTC')
                end_date = pd.to_datetime(end_date).tz_localize('UTC')
            except ValueError:
                logger.error("Invalid date format. Expected YYYY-MM-DD.")
                return JsonResponse({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        elif date_range_option != 'all':
            end_date = pd.to_datetime('2025-04-02').tz_localize('UTC')
            start_date = end_date - pd.Timedelta(days=365)
        else:
            earliest_order = Order.objects.earliest('order_date')
            if earliest_order:
                start_timestamp = pd.to_datetime(earliest_order.order_date)
                if start_timestamp.tzinfo is not None:
                    start_date = start_timestamp.tz_convert('UTC')
                else:
                    start_date = start_timestamp.tz_localize('UTC')
            else:
                start_date = pd.to_datetime(today).tz_localize('UTC')
            end_date = pd.to_datetime(today).tz_localize('UTC')

        if start_date > end_date:
            logger.error("Start date is after end date.")
            return JsonResponse({'error': 'Start date must be before end date.'}, status=400)

        start_date = start_date.replace(day=1)

        orders = Order.objects.filter(order_date__gte=start_date, order_date__lte=end_date)
        if not orders.exists():
            logger.error("No orders found in the database within the specified date range.")
            return JsonResponse({'error': 'No orders found in the database within the specified date range.'}, status=400)

        df = pd.DataFrame(list(orders.values('order_date', 'customer_email', 'order_total')))
        df['order_date'] = pd.to_datetime(df['order_date'])
        logger.debug(f"Cohort DataFrame shape: {df.shape}")

        # Assign customers to cohorts based on their first purchase
        first_orders = df.groupby('customer_email')['order_date'].min().reset_index()
        first_orders['cohort'] = first_orders['order_date'].dt.strftime('%b %Y')
        df = df.merge(first_orders[['customer_email', 'cohort']], on='customer_email', how='left')

        # Calculate the month difference (reverted to original logic)
        df['order_month'] = df['order_date'].dt.to_period('M')
        df['cohort_month'] = pd.to_datetime(df['cohort'], format='%b %Y').dt.to_period('M')
        df['month_diff'] = (df['order_month'].dt.start_time - df['cohort_month'].dt.start_time).dt.days // 30

        max_months = 12
        cohort_matrix = []
        cohort_sizes = {}
        cohort_metrics = []
        cohorts = sorted(df['cohort'].unique(), key=lambda x: pd.to_datetime(x, format='%b %Y'))

        for cohort in cohorts:
            cohort_data = df[df['cohort'] == cohort]
            cohort_size = len(cohort_data['customer_email'].unique())
            cohort_sizes[cohort] = cohort_size

            # Ensure 12 months of revenue data
            revenue_rates = [cohort_size]  # New customers
            for month in range(1, max_months + 1):
                revenue = cohort_data[cohort_data['month_diff'] == month]['order_total'].sum() or 0
                revenue_rates.append(round(float(revenue), 2))
            # Pad with zeros if less than 12 months
            while len(revenue_rates) < (1 + max_months):  # 1 (new customers) + 12 months
                revenue_rates.append(0.0)
            cohort_matrix.append({'cohort': cohort, 'revenue_rates': revenue_rates})
            logger.debug(f"Cohort {cohort} revenue rates: {revenue_rates} (length: {len(revenue_rates)})")

            # Calculate metrics ensuring no division by zero
            total_revenue = cohort_data['order_total'].sum() or 0
            purchase_frequency = len(cohort_data) / cohort_size if cohort_size > 0 else 0
            aov = float(total_revenue / len(cohort_data)) if len(cohort_data) > 0 else 0
            revenue_per_customer = float(total_revenue / cohort_size) if cohort_size > 0 else 0
            gross_margin = 0.4  # Assume 40% gross margin
            ltv = (aov * purchase_frequency) * gross_margin

            # Ensure metrics are added to cohort_metrics
            cohort_metrics.append({
                'cohort': cohort,
                'cohort_size': cohort_size,
                'purchase_frequency': round(purchase_frequency, 2),
                'aov': round(aov, 2),
                'revenue_per_customer': round(revenue_per_customer, 2),
                'ltv': round(ltv, 2)
            })
            logger.debug(f"Cohort {cohort} metrics: {cohort_metrics[-1]}")  # Debug the last added metric

        # Calculate overall revenue
        overall_revenue = [df['customer_email'].nunique()]
        for month in range(1, max_months + 1):
            total_revenue = df[df['month_diff'] == month]['order_total'].sum() or 0
            overall_revenue.append(round(float(total_revenue), 2))
        while len(overall_revenue) < (1 + max_months):
            overall_revenue.append(0.0)
        cohort_matrix.insert(0, {'cohort': 'Overall', 'revenue_rates': overall_revenue})
        cohort_sizes['Overall'] = df['customer_email'].nunique()

        cohorts_list = [row['cohort'] for row in cohort_matrix]
        revenue_matrix = [row['revenue_rates'] for row in cohort_matrix]
        month_labels = [f"After {i} Months" for i in range(1, max_months + 1)]
        logger.debug(f"Final month_labels: {month_labels}")
        logger.debug(f"Final revenue_matrix: {revenue_matrix}")

        total_cohorts = len(cohort_metrics)
        total_pages = (total_cohorts + items_per_page - 1) // items_per_page
        start_index = (page - 1) * items_per_page
        end_index = start_index + items_per_page
        paginated_cohort_metrics = cohort_metrics[start_index:end_index]

        export_data = {}
        for cohort in cohorts:
            customers = df[df['cohort'] == cohort]['customer_email'].unique().tolist()
            export_data[cohort] = customers

        data = {
            'cohorts': cohorts_list,
            'revenue_matrix': revenue_matrix,
            'month_labels': month_labels,
            'cohort_metrics': paginated_cohort_metrics,
            'total_pages': total_pages,
            'current_page': page,
            'export_data': export_data,
        }
        logger.info("Cohort analysis data fetched successfully.")
        return JsonResponse(data, safe=False)

    except Exception as e:
        logger.error(f"Error in cohort_data: {str(e)}", exc_info=True)
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)
    
def cohort_analysis(request):
    return render(request, 'dashboard/cohort_analysis.html')  



def financial_insights_data(request):
    """
    API endpoint to provide data for financial insights visualizations.
    """
    try:
        logger.info("Fetching financial insights data...")

        # Get query parameters for date range
        start_date = request.GET.get('start_date', None)
        end_date = request.GET.get('end_date', None)
        date_range_option = request.GET.get('date_range_option', 'last_1_year')  # Default to last 1 year
        logger.info(f"Received parameters: start_date={start_date}, end_date={end_date}, date_range_option={date_range_option}")

        # Get the earliest order date to determine the range
        earliest_order = Order.objects.earliest('order_date')
        earliest_date = earliest_order.order_date.date() if earliest_order else timezone.now().date()
        today = timezone.now().date()
        earliest_month = earliest_date.replace(day=1)
        logger.info(f"Earliest date: {earliest_date}, Today: {today}, Earliest month: {earliest_month}")

        # Adjust the timeline based on the date range
        if start_date and end_date:
            start_date = pd.to_datetime(start_date).tz_localize('UTC')
            end_date = pd.to_datetime(end_date).tz_localize('UTC')
            timeline_start = start_date.date().replace(day=1)
            timeline_end = end_date.date().replace(day=1)
        elif date_range_option == 'all':
            timeline_start = earliest_month
            timeline_end = today.replace(day=1)
        else:
            # Default to the most recent 1 year (April 2024 to April 2025)
            end_date = pd.to_datetime('2025-04-02').tz_localize('UTC')  # Current date
            start_date = end_date - pd.Timedelta(days=365)  # 1 year ago
            timeline_start = start_date.date().replace(day=1)
            timeline_end = end_date.date().replace(day=1)
        logger.info(f"Timeline: start={timeline_start}, end={timeline_end}")

        # 1. Shipping Charges Trend (by month)
        shipping_charges_query = (Order.objects
                                 .annotate(month=TruncMonth('order_date'))
                                 .values('month')
                                 .annotate(total_shipping=Sum('shipping_charge'))
                                 .order_by('month'))

        # Apply date range filter to shipping charges
        if start_date and end_date:
            shipping_charges_query = shipping_charges_query.filter(order_date__gte=start_date, order_date__lte=end_date)
        elif date_range_option != 'all':
            shipping_charges_query = shipping_charges_query.filter(order_date__gte=start_date, order_date__lte=end_date)

        shipping_charges = list(shipping_charges_query)
        logger.info(f"Shipping charges query result: {shipping_charges}")

        shipping_months = []
        shipping_values = []
        current_month = timeline_start
        while current_month <= timeline_end:
            shipping_months.append(current_month.strftime('%Y-%m'))
            shipping_value = next((item['total_shipping'] for item in shipping_charges if item['month'].date() == current_month), 0)
            shipping_values.append(float(shipping_value) if shipping_value else 0)
            current_month = (current_month + timedelta(days=32)).replace(day=1)
        logger.info(f"Shipping data: months={shipping_months}, values={shipping_values}")

        # 2. Tax Collected by Month
        tax_collected_query = (Order.objects
                              .annotate(month=TruncMonth('order_date'))
                              .values('month')
                              .annotate(total_tax=Sum('order_tax'))
                              .order_by('month'))

        # Apply date range filter to tax collected
        if start_date and end_date:
            tax_collected_query = tax_collected_query.filter(order_date__gte=start_date, order_date__lte=end_date)
        elif date_range_option != 'all':
            tax_collected_query = tax_collected_query.filter(order_date__gte=start_date, order_date__lte=end_date)

        tax_collected = list(tax_collected_query)
        logger.info(f"Tax collected query result: {tax_collected}")

        tax_months = []
        tax_values = []
        current_month = timeline_start
        while current_month <= timeline_end:
            tax_months.append(current_month.strftime('%Y-%m'))
            tax_value = next((item['total_tax'] for item in tax_collected if item['month'].date() == current_month), 0)
            tax_values.append(float(tax_value) if tax_value else 0)
            current_month = (current_month + timedelta(days=32)).replace(day=1)
        logger.info(f"Tax data: months={tax_months}, values={tax_values}")

        data = {
            'shipping_months': shipping_months,
            'shipping_values': shipping_values,
            'tax_months': tax_months,
            'tax_values': tax_values,
        }
        logger.info("Financial insights data fetched successfully:", data)
        return JsonResponse(data, safe=False)

    except Exception as e:
        logger.error(f"Error in financial_insights_data: {str(e)}", exc_info=True)
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)


def product_insights_data(request):
    try:
        # Get query parameters
        selected_product = request.GET.get('product', None)
        date_range_option = request.GET.get('date_range_option', 'last_1_year')
        start_date_str = request.GET.get('start_date', None)
        end_date_str = request.GET.get('end_date', None)

        # Determine the date range
        today = timezone.now().date()

        # Parse start_date and end_date if provided
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        else:
            # Default date range based on date_range_option
            if date_range_option == 'last_1_year':
                start_date = today - timedelta(days=365)
                end_date = today
            else:  # 'all' or any other value
                earliest_order = Order.objects.earliest('order_date')
                start_date = earliest_order.order_date.date() if earliest_order else today
                end_date = today

        # Ensure start_date is not after end_date
        if start_date > end_date:
            return JsonResponse({'error': 'Start date must be before end date.'}, status=400)

        # Adjust start_date to the first day of the month for consistency
        start_date = start_date.replace(day=1)

        # 1. Top Products by Revenue (top 10 products by product_row_total)
        top_products_query = (Order.objects
                             .filter(order_date__date__gte=start_date, order_date__date__lte=end_date)
                             .values('product_name')
                             .annotate(total_revenue=Sum('product_row_total'))
                             .order_by('-total_revenue')[:10])  # Limit to top 10
        product_names_revenue = [item['product_name'] for item in top_products_query]
        revenue_values = [float(item['total_revenue']) if item['total_revenue'] else 0 for item in top_products_query]

        # 2. List of all unique product names for the dropdown
        # We don't filter by date for the product list to ensure all products are available for selection
        product_names = Order.objects.values('product_name').distinct().order_by('product_name')
        product_list = [item['product_name'] for item in product_names]

        # 3. Product Quantity Sold Over Time (by month, filtered by selected product and date range)
        # Filter by selected product if provided, otherwise show total for all products
        if selected_product and selected_product != 'All Products':
            quantity_over_time = (Order.objects
                                 .filter(product_name=selected_product,
                                         order_date__date__gte=start_date,
                                         order_date__date__lte=end_date)
                                 .annotate(month=TruncMonth('order_date'))
                                 .values('month')
                                 .annotate(total_quantity=Sum('product_quantity'))
                                 .order_by('month'))
        else:
            quantity_over_time = (Order.objects
                                 .filter(order_date__date__gte=start_date,
                                         order_date__date__lte=end_date)
                                 .annotate(month=TruncMonth('order_date'))
                                 .values('month')
                                 .annotate(total_quantity=Sum('product_quantity'))
                                 .order_by('month'))

        # Generate a list of months and quantities, filling in gaps with zeros
        quantity_months = []
        quantity_values = []
        current_month = start_date
        while current_month <= end_date:
            quantity_months.append(current_month.strftime('%Y-%m'))
            quantity_value = next((item['total_quantity'] for item in quantity_over_time if item['month'].date() == current_month), 0)
            quantity_values.append(quantity_value)
            # Move to the next month
            current_month = (current_month + timedelta(days=32)).replace(day=1)

        data = {
            'product_names_revenue': product_names_revenue,
            'revenue_values': revenue_values,
            'product_list': product_list,  # List of all products for the dropdown
            'quantity_months': quantity_months,
            'quantity_values': quantity_values,
        }
        return JsonResponse(data, safe=False)

    except Exception as e:
        logger.error(f"Error in product_insights_data: {str(e)}")
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)


def customer_profile(request):
    return render(request, 'dashboard/customer_profile.html')


def customer_profile_data(request):
    try:
        logger.info("Fetching customer profile data...")

        # Load RFM segments and churn model (do this once per request)
        rfm_segments = load_rfm_segments()
        churn_model, churn_scaler = load_churn_model_and_scaler()

        if rfm_segments is None or churn_model is None or churn_scaler is None:
            logger.error("Failed to load RFM segments or churn model.")
            return JsonResponse({'error': 'Failed to load ML models'}, status=500)

        # Get the selected customer name from the query parameter
        customer_name = request.GET.get('customer_name', None)
        if not customer_name:
            # If no customer is selected, return a list of all customers for the dropdown
            customers = (Order.objects.values('customer_name')
                        .distinct()
                        .order_by('customer_name'))
            customer_list = [item['customer_name'] for item in customers]
            return JsonResponse({'customers': customer_list})

        # Fetch all orders for the selected customer
        customer_orders = (Order.objects.filter(customer_name=customer_name)
                          .order_by('order_date'))

        if not customer_orders.exists():
            return JsonResponse({'error': 'Customer not found'}, status=404)

        # Customer Details
        customer_email = customer_orders.first().customer_email
        first_order_date = customer_orders.first().order_date.date()
        last_order_date = customer_orders.last().order_date.date()

        # Lifespan (in days)
        lifespan_days = (last_order_date - first_order_date).days
        lifespan_months = round(lifespan_days / 30.42, 2)  # Approximate months

        # LTV (sum of order_total)
        ltv_result = customer_orders.aggregate(total_spent=Sum('order_total'))['total_spent']
        logger.debug(f"LTV Result for {customer_name}: {ltv_result}")
        ltv = float(ltv_result) if ltv_result is not None else 0.0
        logger.debug(f"Processed LTV for {customer_name}: {ltv}")

        # Average Days Between Orders
        order_dates = [order.order_date.date() for order in customer_orders]
        if len(order_dates) > 1:
            time_diffs = [(order_dates[i+1] - order_dates[i]).days for i in range(len(order_dates)-1)]
            avg_days_between_orders = round(sum(time_diffs) / len(time_diffs), 2)
        else:
            avg_days_between_orders = 0

        # Estimated Next Order Date
        if avg_days_between_orders > 0:
            est_next_order_date = last_order_date + timedelta(days=avg_days_between_orders)
        else:
            est_next_order_date = last_order_date  # If only one order, use the last order date

        # LTV Over Time (30 days, 90 days, 1 year, 2 years, 5 years)
        ltv_over_time = {
            '30_days': 0,
            '90_days': 0,
            '1_year': 0,
            '2_years': 0,
            '5_years': 0,
        }
        for order in customer_orders:
            days_since_first = (order.order_date.date() - first_order_date).days
            order_value = order.order_total or 0
            if days_since_first <= 30:
                ltv_over_time['30_days'] += order_value
            if days_since_first <= 90:
                ltv_over_time['90_days'] += order_value
            if days_since_first <= 365:
                ltv_over_time['1_year'] += order_value
            if days_since_first <= 730:
                ltv_over_time['2_years'] += order_value
            if days_since_first <= 1825:
                ltv_over_time['5_years'] += order_value

        # Cumulative LTV (each period includes previous periods)
        ltv_over_time['90_days'] += ltv_over_time['30_days']
        ltv_over_time['1_year'] += ltv_over_time['90_days']
        ltv_over_time['2_years'] += ltv_over_time['1_year']
        ltv_over_time['5_years'] += ltv_over_time['2_years']

        # Top 10% for LTV and Lifetime
        all_customers = (Order.objects.values('customer_name')
                        .annotate(total_spent=Sum('order_total'),
                                 first_order=Min('order_date'),
                                 last_order=Max('order_date')))
        ltv_values = [customer['total_spent'] for customer in all_customers if customer['total_spent'] is not None]
        lifetime_values = [(customer['last_order'].date() - customer['first_order'].date()).days / 30.42
                          for customer in all_customers]
        
        ltv_values.sort(reverse=True)
        lifetime_values.sort(reverse=True)
        
        top_10_percent_ltv = ltv_values[:max(1, len(ltv_values) // 10)][-1] if ltv_values else 0
        top_10_percent_lifetime = lifetime_values[:max(1, len(lifetime_values) // 10)][-1] if lifetime_values else 0
        
        is_top_10_ltv = ltv >= top_10_percent_ltv
        is_top_10_lifetime = lifespan_months >= top_10_percent_lifetime

        # Calculate features for churn prediction (same as in ml_data_preparation.py)
        current_date = pd.to_datetime('2025-04-01').tz_localize('UTC')
        frequency = customer_orders.count()
        monetary = ltv
        recency = (current_date - customer_orders.last().order_date).total_seconds() / (24 * 3600)

        customer_features = {
            'recency': recency,
            'frequency': frequency,
            'monetary': monetary,
            'avg_days_between_orders': avg_days_between_orders
        }

        # Get RFM segment
        rfm_segment = rfm_segments.get(customer_name, "Unknown")

        # Predict churn probability
        churn_prob = predict_churn(customer_features, churn_model, churn_scaler)
        churn_rate = round(churn_prob * 100, 2)  # Convert to percentage

        data = {
            'customer_name': customer_name,
            'customer_email': customer_email,
            'first_order_date': first_order_date.strftime('%d %b %Y'),
            'last_order_date': last_order_date.strftime('%d %b %Y'),
            'ltv': ltv,
            'lifetime_months': lifespan_months,
            'avg_days_between_orders': avg_days_between_orders,
            'est_next_order_date': est_next_order_date.strftime('%d %b %Y'),
            'is_top_10_ltv': is_top_10_ltv,
            'is_top_10_lifetime': is_top_10_lifetime,
            'ltv_over_time': ltv_over_time,
            'rfm_segment': rfm_segment,
            'churn_rate': churn_rate
        }
        logger.info(f"Customer profile data fetched successfully for {customer_name}.")
        return JsonResponse(data)

    except Exception as e:
        logger.error(f"Error in customer_profile_data: {str(e)}", exc_info=True)
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)

def rfm_churn_visualizations(request):
    try:
        logger.info("Fetching RFM and churn visualization data...")

        # Load the RFM features with segments
        rfm_file_path = os.path.join(settings.BASE_DIR, 'dashboard', 'rfm_features_with_segments.csv')
        if not os.path.exists(rfm_file_path):
            logger.error(f"RFM features file not found at {rfm_file_path}")
            return render(request, 'dashboard/rfm_churn_visualizations.html', {'error': 'RFM features file not found'})

        df = pd.read_csv(rfm_file_path)

        # RFM Segment Distribution
        segment_counts = df['Segment'].value_counts().to_dict()
        segment_data = {
            'labels': list(segment_counts.keys()),
            'values': list(segment_counts.values())
        }

        # Churn Trend (Monthly Average Churn Rate)
        # Convert last_order_date to datetime and extract year-month
        df['last_order_date'] = pd.to_datetime(df['last_order_date'])
        df['year_month'] = df['last_order_date'].dt.to_period('M').astype(str)

        # Group by year-month and calculate average churn rate
        churn_trend = df.groupby('year_month')['Churn'].mean().reset_index()
        # Convert churn rate to percentage
        churn_trend['Churn'] = (churn_trend['Churn'] * 100).round(2)
        # Sort by year-month
        churn_trend = churn_trend.sort_values('year_month')
        churn_trend_data = {
            'labels': churn_trend['year_month'].tolist(),
            'values': churn_trend['Churn'].tolist()
        }

        data = {
            'segment_data': segment_data,
            'churn_trend_data': churn_trend_data
        }

        # Convert the data to a JSON string for display
        json_data = json.dumps(data)

        logger.info("RFM and churn visualization data fetched successfully.")
        return render(request, 'dashboard/rfm_churn_visualizations.html', {'json_data': json_data})

    except Exception as e:
        logger.error(f"Error in rfm_churn_visualizations: {str(e)}", exc_info=True)
        return render(request, 'dashboard/rfm_churn_visualizations.html', {'error': f'Server error: {str(e)}'})

def rfm_churn_visualizations_data(request):
    """
    API endpoint to provide data for RFM segment distribution, active customers/orders visualizations,
    average order value over time, and customer recommendations with pagination and filters.
    """
    try:
        logger.info("Fetching RFM, active customers/orders, AOV, and recommendations data...")

        # Load the RFM features with segments
        rfm_file_path = os.path.join(settings.BASE_DIR, 'dashboard', 'rfm_features_with_segments.csv')
        if not os.path.exists(rfm_file_path):
            logger.error(f"RFM features file not found at {rfm_file_path}")
            return JsonResponse({'error': 'RFM features file not found'}, status=500)

        df = pd.read_csv(rfm_file_path)

        # Filter parameters
        filter_segment = request.GET.get('filter_segment', None)
        start_date = request.GET.get('start_date', None)
        end_date = request.GET.get('end_date', None)
        date_range_option = request.GET.get('date_range_option', 'last_1_year')  # Default to last 1 year

        # Apply segment filter to RFM data
        if filter_segment and filter_segment != 'All':
            df = df[df['Segment'] == filter_segment]

        # RFM Segment Distribution
        segment_counts = df['Segment'].value_counts().to_dict()
        segment_data = {
            'labels': list(segment_counts.keys()),
            'values': list(segment_counts.values())
        }

        # Load orders for time-series data
        orders = Order.objects.all().values('order_date', 'order_total')
        orders_df = pd.DataFrame(orders)
        orders_df['order_date'] = pd.to_datetime(orders_df['order_date'])
        orders_df['year_month'] = orders_df['order_date'].dt.to_period('M')

        # Apply date range filter to orders
        if start_date and end_date:
            start_date = pd.to_datetime(start_date).tz_localize('UTC')
            end_date = pd.to_datetime(end_date).tz_localize('UTC')
        else:
            # Set default date range to the most recent 1 year if not specified
            if date_range_option == 'all':
                # Use the full range of the data
                start_date = min(orders_df['order_date'].min(), pd.to_datetime(df['last_order_date'].min()))
                end_date = max(orders_df['order_date'].max(), pd.to_datetime(df['last_order_date'].max()))
            else:
                # Default to the most recent 1 year (April 2024 to April 2025)
                end_date = pd.to_datetime('2025-04-02').tz_localize('UTC')  # Current date
                start_date = end_date - pd.Timedelta(days=365)  # 1 year ago

            # Apply the default date range to orders
            orders_df = orders_df[
                (orders_df['order_date'] >= start_date) & 
                (orders_df['order_date'] <= end_date)
            ]

        # Apply date range filter to RFM data (for active customers)
        df['last_order_date'] = pd.to_datetime(df['last_order_date'])
        df['year_month'] = df['last_order_date'].dt.to_period('M')
        if start_date and end_date:
            df_filtered = df[
                (df['last_order_date'] >= start_date) & 
                (df['last_order_date'] <= end_date)
            ]
        else:
            df_filtered = df

        # Active Customers and Orders Over Time
        active_customers = df_filtered[df_filtered['Churn'] == 0].groupby('year_month').size().reset_index(name='active_customers')
        orders_per_month = orders_df.groupby('year_month').size().reset_index(name='order_count')

        # Average Order Value Over Time
        aov_per_month = orders_df.groupby('year_month')['order_total'].mean().reset_index(name='avg_order_value')
        aov_per_month['avg_order_value'] = aov_per_month['avg_order_value'].round(2)

        # Create a continuous timeline
        if start_date and end_date:
            earliest_month = pd.to_datetime(start_date).to_period('M')
            latest_month = pd.to_datetime(end_date).to_period('M')
        else:
            earliest_month = min(df['year_month'].min(), orders_df['year_month'].min())
            latest_month = max(df['year_month'].max(), orders_df['year_month'].max())

        all_months = pd.period_range(start=earliest_month, end=latest_month, freq='M')
        all_months_df = pd.DataFrame({'year_month': all_months})
        all_months_df['year_month'] = all_months_df['year_month'].astype('period[M]')

        # Merge with the continuous timeline
        active_customers = all_months_df.merge(active_customers, on='year_month', how='left').fillna({'active_customers': 0})
        orders_per_month = all_months_df.merge(orders_per_month, on='year_month', how='left').fillna({'order_count': 0})
        aov_per_month = all_months_df.merge(aov_per_month, on='year_month', how='left').fillna({'avg_order_value': 0})

        # Convert year_month to string for JSON serialization
        active_customers['year_month'] = active_customers['year_month'].astype(str)
        orders_per_month['year_month'] = orders_per_month['year_month'].astype(str)
        aov_per_month['year_month'] = aov_per_month['year_month'].astype(str)

        active_customers_data = {
            'labels': active_customers['year_month'].tolist(),
            'active_customers': active_customers['active_customers'].tolist(),
            'orders': orders_per_month['order_count'].tolist(),
            'avg_order_value': aov_per_month['avg_order_value'].tolist()
        }

        # Customer Recommendations with Pagination
        recommendations = {
            'Loyal Customer': 'Reward with a loyalty discount or exclusive offer to maintain engagement.',
            'Active Customer': 'Encourage repeat purchases with a limited-time promotion.',
            'Average Customer': 'Send a personalized email with product recommendations to increase engagement.',
            'At Risk': 'Send a re-engagement email with a discount to win them back.',
            'New Customer': 'Welcome them with an onboarding email and a small discount on their next purchase.'
        }

        page = int(request.GET.get('page', 1))
        segment = request.GET.get('segment', None)
        items_per_page = 10

        customer_data = {}
        pagination_data = {}
        if segment:
            segment_df = df[df['Segment'] == segment][['customer_name', 'customer_email', 'recency', 'frequency', 'monetary', 'Churn']]
            segment_df['Churn'] = segment_df['Churn'].apply(lambda x: 'Yes' if x == 1 else 'No')
            segment_df['Recommended Action'] = recommendations.get(segment, 'No action specified.')

            total_items = len(segment_df)
            total_pages = (total_items + items_per_page - 1) // items_per_page
            start_idx = (page - 1) * items_per_page
            end_idx = start_idx + items_per_page
            paginated_df = segment_df.iloc[start_idx:end_idx]

            customer_data[segment] = paginated_df.to_dict('records')
            pagination_data[segment] = {
                'current_page': page,
                'total_pages': total_pages,
                'total_items': total_items,
                'items_per_page': items_per_page
            }
        else:
            for segment in df['Segment'].unique():
                segment_df = df[df['Segment'] == segment][['customer_name', 'customer_email', 'recency', 'frequency', 'monetary', 'Churn']]
                segment_df['Churn'] = segment_df['Churn'].apply(lambda x: 'Yes' if x == 1 else 'No')
                segment_df['Recommended Action'] = recommendations.get(segment, 'No action specified.')

                total_items = len(segment_df)
                total_pages = (total_items + items_per_page - 1) // items_per_page
                start_idx = 0
                end_idx = items_per_page
                paginated_df = segment_df.iloc[start_idx:end_idx]

                customer_data[segment] = paginated_df.to_dict('records')
                pagination_data[segment] = {
                    'current_page': 1,
                    'total_pages': total_pages,
                    'total_items': total_items,
                    'items_per_page': items_per_page
                }

        data = {
            'segment_data': segment_data,
            'active_customers_data': active_customers_data,
            'customer_data': customer_data,
            'recommendations': recommendations,
            'pagination_data': pagination_data
        }
        logger.info("RFM, active customers/orders, AOV, and recommendations data fetched successfully.")
        return JsonResponse(data)

    except Exception as e:
        logger.error(f"Error in rfm_churn_visualizations_data: {str(e)}", exc_info=True)
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)
    
    
def download_rfm_data(request):
    """
    View to download the RFM features with segments as a CSV file.
    """
    try:
        logger.info("Initiating download of RFM data...")

        # Path to the RFM features file
        rfm_file_path = os.path.join(settings.BASE_DIR, 'dashboard', 'rfm_features_with_segments.csv')
        if not os.path.exists(rfm_file_path):
            logger.error(f"RFM features file not found at {rfm_file_path}")
            return HttpResponse("RFM features file not found.", status=404)

        # Read the file and serve it as a download
        with open(rfm_file_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="rfm_features_with_segments.csv"'
            response['Content-Length'] = os.path.getsize(rfm_file_path)
            logger.info("RFM data download successful.")
            return response

    except Exception as e:
        logger.error(f"Error in download_rfm_data: {str(e)}", exc_info=True)
        return HttpResponse(f"Server error: {str(e)}", status=500)


def signup_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password1 = request.POST.get('password1')
        password2 = request.POST.get('password2')

        if password1 != password2:
            messages.error(request, "Passwords do not match.")
            return redirect('signup')

        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already exists.")
            return redirect('signup')

        if User.objects.filter(email=email).exists():
            messages.error(request, "Email already exists.")
            return redirect('signup')

        user = User.objects.create_user(username=username, email=email, password=password1)
        user.save()
        messages.success(request, "Account created successfully! Please sign in.")
        return redirect('signin')

    return render(request, 'dashboard/signup.html')

def signin_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('dashboard')
        else:
            messages.error(request, "Invalid username or password.")
            return redirect('signin')

    return render(request, 'dashboard/signin.html')

def signout_view(request):
    logout(request)
    return redirect('signin')

