import os
import sys
import django
import pandas as pd
from datetime import datetime
import pytz  # Import pytz for timezone handling

# Set up Django environment
project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'caddy_dashboard.settings')
django.setup()

from dashboard.models import Order

def extract_data():
    print("Extracting data from Order model...")
    orders = Order.objects.all().values('customer_name', 'customer_email', 'order_date', 'order_id', 'order_total')
    df = pd.DataFrame(list(orders))
    
    if df.empty:
        print("No data found in the Order model.")
        return None
    
    print(f"Extracted {len(df)} orders.")
    return df

def clean_and_standardize_data(df):
    print("Cleaning and standardizing data...")
    
    # Remove duplicates based on order_id
    df = df.drop_duplicates(subset=['order_id'])
    print(f"After removing duplicates: {len(df)} orders.")
    
    # Handle missing values
    df['customer_name'] = df['customer_name'].fillna('Unknown')
    df['customer_email'] = df['customer_email'].fillna('unknown@example.com')
    df['order_total'] = df['order_total'].fillna(0.0)
    
    # Ensure order_date is in datetime format
    df['order_date'] = pd.to_datetime(df['order_date'])
    
    # Standardize numerical fields (normalize order_total between 0 and 1)
    if df['order_total'].max() != df['order_total'].min():
        df['order_total_normalized'] = (df['order_total'] - df['order_total'].min()) / (df['order_total'].max() - df['order_total'].min())
    else:
        df['order_total_normalized'] = 0.0
    
    print("Data cleaned and standardized successfully.")
    return df

def create_features(df):
    print("Creating features for RFM and churn prediction...")
    
    # Define the current date for recency calculation (April 1, 2025), make it timezone-aware in UTC
    current_date = pd.to_datetime('2025-04-01').tz_localize('UTC')
    
    # Get the most recent customer_email for each customer_name
    # Sort by order_date to ensure the latest email is selected
    customer_emails = df.sort_values('order_date').groupby('customer_name')['customer_email'].last().reset_index()
    
    # Group by customer to calculate RFM features
    rfm_df = df.groupby('customer_name').agg({
        'order_date': ['max', 'count'],  # For Recency (max) and Frequency (count)
        'order_total': 'sum',           # For Monetary
    }).reset_index()
    
    # Flatten column names
    rfm_df.columns = ['customer_name', 'last_order_date', 'frequency', 'monetary']
    
    # Ensure last_order_date is timezone-aware (it should already be in UTC from the database)
    rfm_df['last_order_date'] = rfm_df['last_order_date'].dt.tz_localize('UTC') if rfm_df['last_order_date'].dt.tz is None else rfm_df['last_order_date']
    
    # Calculate Recency (days since last order)
    rfm_df['recency'] = (current_date - rfm_df['last_order_date']).dt.total_seconds() / (24 * 3600)
    
    # Calculate additional features for churn prediction
    # Average time between orders
    avg_time_between = df.groupby('customer_name').apply(
        lambda x: (x['order_date'].sort_values().diff().dt.total_seconds() / (24 * 3600)).mean()
    ).reset_index(name='avg_days_between_orders')
    
    # Merge with RFM data
    rfm_df = rfm_df.merge(avg_time_between, on='customer_name', how='left')
    
    # Merge with customer_email
    rfm_df = rfm_df.merge(customer_emails, on='customer_name', how='left')
    
    # Fill NaN values for avg_days_between_orders (for customers with only 1 order)
    rfm_df['avg_days_between_orders'] = rfm_df['avg_days_between_orders'].fillna(0)
    
    print("Features created successfully:")
    print(rfm_df.head())
    return rfm_df

def main():
    # Extract the data
    df = extract_data()
    if df is not None:
        # Clean and standardize
        df = clean_and_standardize_data(df)
        # Create features
        rfm_df = create_features(df)
        # Save the processed data to a CSV file in the dashboard directory
        output_path = os.path.join(project_dir, 'dashboard', 'rfm_features.csv')
        rfm_df.to_csv(output_path, index=False)
        print(f"Processed data saved to {output_path}")

if __name__ == "__main__":
    main()