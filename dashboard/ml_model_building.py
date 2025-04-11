import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import joblib
import os

def load_features():
    print("Loading features from rfm_features.csv...")
    # Construct the path to rfm_features.csv
    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    features_path = os.path.join(project_dir, 'dashboard', 'rfm_features.csv')
    
    if not os.path.exists(features_path):
        print(f"Error: {features_path} does not exist.")
        return None
    
    df = pd.read_csv(features_path)
    print(f"Loaded {len(df)} customer records.")
    return df

def perform_rfm_analysis(df):
    print("Performing RFM analysis...")
    
    # Calculate RFM scores (1 to 5) using quantiles
    # Recency: Lower is better (more recent), so reverse the scoring
    r_labels = range(5, 0, -1)  # 5 (most recent) to 1 (least recent)
    r_quartiles = pd.qcut(df['recency'], q=5, labels=r_labels)
    df['R'] = r_quartiles
    
    # Frequency: Higher is better
    f_labels = range(1, 6)  # 1 (least frequent) to 5 (most frequent)
    f_quartiles = pd.qcut(df['frequency'].rank(method='first'), q=5, labels=f_labels)
    df['F'] = f_quartiles
    
    # Monetary: Higher is better
    m_labels = range(1, 6)  # 1 (lowest spending) to 5 (highest spending)
    m_quartiles = pd.qcut(df['monetary'], q=5, labels=m_labels)
    df['M'] = m_quartiles
    
    # Combine RFM scores into a single score
    df['RFM_Score'] = df['R'].astype(str) + df['F'].astype(str) + df['M'].astype(str)
    
    # Assign customer segments based on RFM scores
    def assign_segment(row):
        r, f, m = int(row['R']), int(row['F']), int(row['M'])
        if r >= 4 and f >= 4 and m >= 4:
            return "Loyal Customer"
        elif r >= 3 and f >= 3 and m >= 3:
            return "Active Customer"
        elif r >= 2 and f >= 2 and m >= 2:
            return "Average Customer"
        elif r <= 2 and f <= 2 and m <= 2:
            return "At Risk"
        else:
            return "New Customer"
    
    df['Segment'] = df.apply(assign_segment, axis=1)
    
    print("RFM analysis completed:")
    print(df[['customer_name', 'R', 'F', 'M', 'RFM_Score', 'Segment']].head())
    return df

def train_churn_model(df):
    print("Training churn prediction model...")
    
    # Define churn: Assume a customer has churned if they haven't ordered in the last 180 days
    # (This is a simple rule; you can adjust the threshold based on your business needs)
    df['Churn'] = (df['recency'] > 180).astype(int)  # 1 = Churned, 0 = Active
    
    # Features for churn prediction
    features = ['recency', 'frequency', 'monetary', 'avg_days_between_orders']
    X = df[features]
    y = df['Churn']
    
    # Split the data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Standardize the features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train a Logistic Regression model
    model = LogisticRegression(random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Evaluate the model
    train_score = model.score(X_train_scaled, y_train)
    test_score = model.score(X_test_scaled, y_test)
    print(f"Training accuracy: {train_score:.2f}")
    print(f"Testing accuracy: {test_score:.2f}")
    
    # Save the model and scaler
    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(project_dir, 'dashboard', 'churn_model.joblib')
    scaler_path = os.path.join(project_dir, 'dashboard', 'scaler.joblib')
    
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    print(f"Churn model saved to {model_path}")
    print(f"Scaler saved to {scaler_path}")
    
    return df, model, scaler

def main():
    # Load the features
    df = load_features()
    if df is None:
        return
    
    # Perform RFM analysis
    df = perform_rfm_analysis(df)
    
    # Train the churn prediction model
    df, model, scaler = train_churn_model(df)
    
    # Save the updated DataFrame with RFM segments and churn labels
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dashboard', 'rfm_features_with_segments.csv')
    df.to_csv(output_path, index=False)
    print(f"Updated features with segments saved to {output_path}")

if __name__ == "__main__":
    main()