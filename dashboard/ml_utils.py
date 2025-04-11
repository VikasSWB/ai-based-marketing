import pandas as pd
import joblib
import os

def load_rfm_segments():
    print("Loading RFM segments...")
    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rfm_path = os.path.join(project_dir, 'dashboard', 'rfm_features_with_segments.csv')
    
    if not os.path.exists(rfm_path):
        print(f"Error: {rfm_path} does not exist.")
        return None
    
    rfm_df = pd.read_csv(rfm_path)
    # Create a dictionary for quick lookup: {customer_name: segment}
    rfm_dict = dict(zip(rfm_df['customer_name'], rfm_df['Segment']))
    print(f"Loaded RFM segments for {len(rfm_dict)} customers.")
    return rfm_dict

def load_churn_model_and_scaler():
    print("Loading churn model and scaler...")
    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(project_dir, 'dashboard', 'churn_model.joblib')
    scaler_path = os.path.join(project_dir, 'dashboard', 'scaler.joblib')
    
    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        print(f"Error: Model or scaler file does not exist.")
        return None, None
    
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    print("Churn model and scaler loaded successfully.")
    return model, scaler

def predict_churn(customer_features, model, scaler):
    print("Predicting churn probability...")
    # Features must match the order used during training: ['recency', 'frequency', 'monetary', 'avg_days_between_orders']
    features = [[
        customer_features['recency'],
        customer_features['frequency'],
        customer_features['monetary'],
        customer_features['avg_days_between_orders']
    ]]
    
    # Standardize the features using the loaded scaler
    features_scaled = scaler.transform(features)
    
    # Predict churn probability
    churn_prob = model.predict_proba(features_scaled)[0][1]  # Probability of churn (class 1)
    return churn_prob