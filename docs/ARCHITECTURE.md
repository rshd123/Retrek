<div align="center">

# System Architecture

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 25, 'rankSpacing': 70, 'curve': 'basis'}}}%%
flowchart TD
    subgraph INGEST["1. Ingestion Layer"]
        W1["Live Razorpay Webhook<br/>payment.failed, link.expired<br/>Auto-triggers recovery pipeline"]
        W2["Batch Dataset Ingest<br/>20 Scenarios, 7 Types<br/>POST /api/transactions/seed"]
        W3["Manual / API Ingest<br/>POST /api/transactions/ingest<br/>Custom decline codes, amounts"]
    end

    subgraph DIAGNOSE["2. Cognitive AI Diagnosis Engine"]
        ISO["ISO-8583 Banking Ontology<br/>16 Decline Codes, 4 Categories<br/>Technical / Financial / Customer / Fraud"]
        ACT["Dynamic Actuarial Model<br/>Base + Loyalty +3%/order<br/>Retry -15%/attempt, Ticket +/-5-10%"]
        LLM["Groq LPU Inference<br/>qwen/qwen3.6-27b, temp 0.2<br/>JSON Mode, actuarial weights"]
        OUT["Empathetic Message Generation<br/>Hinglish + English Dual Output<br/>Voice Call Scripts for Support"]
    end

    subgraph POLICY["3. Deterministic 3-Gate Policy Engine"]
        G1["Gate 1: AUTO_EXECUTE<br/>Recovery >= 65%, Ticket < 10k<br/>Retries within safe limit"]
        G2["Gate 2: HUMAN_APPROVAL<br/>Recovery 50-64%, Ticket >= 10k<br/>Requires merchant swipe"]
        G3["Gate 3: STOP_RULE<br/>Fraud / Stolen Card, Max Retries<br/>Recovery < 50%"]
    end

    subgraph ACT_LAYER["4. Execution Layer"]
        RZP["Razorpay Orders API<br/>POST /v1/orders<br/>Idempotent: retrek_id, paise"]
        MODAL["Embedded Checkout.js<br/>Checkout Modal, /checkout<br/>Real-time status callback"]
        SWIPE["Merchant Approval Queue<br/>1-Click Swipe, Decline w/ Reason<br/>Operator Review Dashboard"]
        STOP["Recovery Halted<br/>Anti-Spam, Bounce Fee Guard<br/>Permanent Fraud Block"]
    end

    subgraph VERIFY["5. Verification and Ledger Layer"]
        WH_VERIFY["Webhook Receiver<br/>POST /api/webhooks/razorpay<br/>paid / failed / expired events"]
        DEDUP["PostgreSQL Atomic Lock<br/>event_id PRIMARY KEY<br/>Concurrent dedup, race safe"]
        AUDIT["Immutable Audit Trail<br/>JSONB Provenance Ledger<br/>AI reasoning + latency tracking"]
        WS["Supabase Realtime<br/>WebSocket Push to Frontend<br/>Instant transaction updates"]
    end

    W1 --> ISO
    W2 --> ISO
    W3 --> ISO

    ISO --> ACT
    ACT --> LLM
    LLM --> OUT

    OUT --> G1
    OUT --> G2
    OUT --> G3

    G1 -->|Auto-Dispatch| RZP
    G2 -->|Escalate| SWIPE
    G3 -->|Permanent Block| STOP

    SWIPE -->|Merchant Approved| RZP
    SWIPE -->|Merchant Declined| STOP

    RZP --> MODAL
    MODAL -->|Customer Pays| WH_VERIFY

    WH_VERIFY --> DEDUP
    DEDUP --> AUDIT
    AUDIT --> WS

    classDef ingest fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,color:#0f172a,padding:14px;
    classDef ai fill:#eff6ff,stroke:#3b82f6,stroke-width:1.5px,color:#1e40af,padding:14px;
    classDef policy fill:#fef3c7,stroke:#f59e0b,stroke-width:1.5px,color:#92400e,padding:14px;
    classDef execute fill:#ecfdf5,stroke:#10b981,stroke-width:1.5px,color:#065f46,padding:14px;
    classDef stop fill:#fef2f2,stroke:#ef4444,stroke-width:1.5px,color:#991b1b,padding:14px;
    classDef ledger fill:#f5f3ff,stroke:#8b5cf6,stroke-width:1.5px,color:#5b21b6,padding:14px;

    class W1,W2,W3 ingest;
    class ISO,ACT,LLM,OUT ai;
    class G1,G2,G3 policy;
    class RZP,MODAL,SWIPE execute;
    class STOP stop;
    class WH_VERIFY,DEDUP,AUDIT,WS ledger;
```

</div>
