from fastapi import FastAPI

app = FastAPI(title="Taco Town Channel Stub", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "channel"}


@app.get("/")
def root():
    return {
        "service": "Taco Town Channel Stub",
        "note": "Simulates WhatsApp/SMS/Email/RCS delivery. No real messages sent.",
        "health": "/health",
    }


# The real /send endpoint + async outcome simulation + callbacks into the CRM receipt
# API are added when we build the channel engine. Tonight this is just a live skeleton.
