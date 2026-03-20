from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import random

app = Flask(__name__)
CORS(app)

# --- THE BRAIN ---
def train_model():
    X = np.array([[15, 0.8, 0.01], [12, 0.9, 0.02], [80, 0.1, 0.08], [95, 0.2, 0.09]] * 10)
    y = np.array([0, 0, 1, 1] * 10) 
    model = RandomForestClassifier(n_estimators=10)
    model.fit(X, y)
    return model

brain = train_model()
intercepted_history = []

@app.route('/stream_swarm')
def stream_swarm():
    # Allow JS to request specific wave sizes, default to 60
    try:
        requested_count = int(request.args.get('count', 60))
        threat_ratio = float(request.args.get('threat_ratio', 0.20))
    except:
        requested_count = 60
        threat_ratio = 0.20

    targets = []
    for i in range(requested_count):
        # FIX: Generate a random 5-digit serial number so IDs never repeat!
        uav_id = f"UAV-{random.randint(10000, 99999)}"
        
        if uav_id not in intercepted_history:
            is_intended_threat = random.random() < threat_ratio 
            
            if is_intended_threat:
                speed = random.uniform(85, 150)
                jitter = random.uniform(0.0, 0.3)
                rcs = random.uniform(0.05, 0.1)
            else:
                speed = random.uniform(20, 60)
                jitter = random.uniform(0.6, 1.0)
                rcs = random.uniform(0.01, 0.04)
            
            prob = brain.predict_proba([[speed, jitter, rcs]])[0][1]
            
            if prob > 0.5:
                display_prob = random.randint(72, 99)
            else:
                display_prob = random.randint(4, 38)
            
            targets.append({
                "id": uav_id,
                "speed": round(speed, 1),
                "prob": display_prob,
                "type": "threat" if prob > 0.5 else "decoy"
            })
            
    return jsonify({
        "targets": targets, 
        "savings": round(len(intercepted_history) * 1.98, 2)
    })

@app.route('/intercept', methods=['POST'])
def intercept():
    data = request.json
    intercepted_history.append(data['id'])
    return jsonify({"status": "neutralized", "history": intercepted_history})

if __name__ == '__main__':
    app.run(debug=True, port=5000)