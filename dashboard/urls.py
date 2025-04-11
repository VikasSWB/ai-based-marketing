


# dashboard/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard_view, name='dashboard'),
    path('chart-data/', views.chart_data, name='chart_data'),
    path('dashboard-data/', views.dashboard_data, name='dashboard_data'),
    path('customer_insights_data/', views.customer_insights_data, name='customer_insights_data'),  # This should exist
    path('financial-insights-data/', views.financial_insights_data, name='financial_insights_data'),
    path('product_insights_data/', views.product_insights_data, name='product_insights_data'),
    path('signup/', views.signup_view, name='signup'),
    path('signin/', views.signin_view, name='signin'),
    path('signout/', views.signout_view, name='signout'),
    path('eda-charts/', views.eda_charts_view, name='eda_charts'),
    path('rfm-analysis/', views.rfm_analysis_view, name='rfm_analysis'),
    #new
    path('customer_profile/', views.customer_profile, name='customer_profile'),
    path('customer_profile_data/', views.customer_profile_data, name='customer_profile_data'),
    path('customer_insights/', views.customer_insights_view, name='customer_insights'),
    path('customer_insights_data/',views.customer_insights_data,name='customer_insights_data'),
    path('financial-insights/', views.financial_insights_view, name='financial_insights'),
    path('product-insights/', views.product_insights_view, name='product_insights'),
    ## NEW ##
    path('rfm_churn_visualizations/', views.rfm_churn_visualizations, name='rfm_churn_visualizations'),
    path('rfm_churn_visualizations_data/', views.rfm_churn_visualizations_data, name='rfm_churn_visualizations_data'),
    path('download_rfm_data/', views.download_rfm_data, name='download_rfm_data'),  # New route
    path('cohort-data/', views.cohort_data, name='cohort_data'),
    path('cohort_analysis/', views.cohort_analysis, name='cohort_analysis'),
    ## NEW ##
]
