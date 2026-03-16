import json
import os
import requests

response = requests.post(
    "https://agent.tinyfish.ai/v1/automation/run-sse",
    headers={
        "X-API-Key": "sk-tinyfish-VSL9tstdbfYzTfXVVE5opK13h_16KzNy",
        "Content-Type": "application/json",
    },
    json={
        "goal": """you are a LinkShield Fraud Detection Agent. You autonomously investigate websites and links for fraud indicators.

Given a Telegram channel URL or username, you will:
1. Analyze channel metadata (name, description, member count patterns, creation date)
2. Identify red flags in the channel content and structure
3. Cross-check admin identity signals
4. Analyze any blockchain wallet addresses mentioned
5. Follow outbound links and assess their legitimacy
6. Compile a structured Fraud Risk Report,
here is the channel link https://t.me/mathsbygaganpratap
 Return result in json format""",
    },
    stream=True,
)

for line in response.iter_lines():
    if line:
        line_str = line.decode("utf-8")
        if line_str.startswith("data: "):
            event = json.loads(line_str[6:])
            print(event)