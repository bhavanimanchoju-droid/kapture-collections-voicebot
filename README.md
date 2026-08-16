# Kapture Finance — Collections Voicebot (Maya)

AI-powered outbound collections voicebot prototype built for the Kapture Finance AI Delivery Intern take-home assignment.

## Overview

Maya is a Vapi-based outbound voice agent designed to handle routine overdue EMI collection conversations in a polite, structured, and privacy-conscious way.

The prototype demonstrates:

- Customer identity verification before account-specific disclosure
- Backend-enforced authorization for protected business actions
- Promise-to-pay capture
- Payment-link triggering
- Dispute handling
- Already-paid handling
- Hardship escalation
- Human-agent escalation
- Do-not-call handling
- Final call disposition
- Public webhook connectivity using ngrok
- Incremental backend and voice testing

The prototype uses mock/test data only. It does not connect to a real lending core, process real payments, or send real customer messages.

## Architecture

```text
Customer
   |
   v
Telephony
   |
   v
Vapi
(STT + LLM/Orchestration + TTS)
   |
   | Tool Calls
   v
Tool Layer
   |
   | HTTPS
   v
Node.js / Express Mock Backend
   |
   +-- Authentication
   +-- Promise-to-Pay
   +-- Payment Link
   +-- Escalation
   +-- Disposition
   |
   v
Logs / Observability
```

During development, ngrok exposes the local Node.js/Express webhook over HTTPS so that Vapi can reach it.

## Security Design

The prototype uses defense in depth:

1. The assistant prompt prevents financial/account information from being disclosed before verification.
2. The backend independently checks authentication before protected tools can execute.

Therefore, a prompt mistake or an attempted tool call cannot by itself bypass the backend authorization boundary.

The authentication state is maintained using the call/session identifier.

## Tools

### `verify_customer`

Verifies the customer's account ID and verification code.

Must be completed successfully before account-specific financial information is disclosed.

### `log_promise_to_pay`

Records an explicit payment commitment.

Inputs:

- `account_id`
- `ptp_date`
- `amount`

The tool is only allowed after successful verification and explicit confirmation of the payment amount/date.

### `send_payment_link`

Simulates sending a payment link to a verified customer through a configured channel.

### `escalate_to_agent`

Escalates cases that require human review, such as:

- disputes
- hardship
- already-paid claims
- customer requests for human assistance
- verification support

### `mark_disposition`

Records the final outcome of the conversation, such as:

- `PTP_AGREED`
- `ALREADY_PAID`
- `DISPUTE`
- `HARDSHIP`
- `WRONG_PERSON`
- `DO_NOT_CALL`
- `CALLBACK_REQUESTED`
- `ESCALATED`
- `NO_RESPONSE`

## Conversation Flow

```text
Opening
   |
Purpose
   |
Authentication
   |
Account ID
   |
Verification Code
   |
verify_customer
   |
   +-- Failure --> Retry / Support / Disposition
   |
   +-- Success
          |
          v
     Debt Disclosure
          |
          v
     Intent Detection
          |
          +--> Will Pay ------> Confirm Amount/Date
          |                         |
          |                         v
          |                   log_promise_to_pay
          |                         |
          |                         v
          |                   Offer Payment Link
          |
          +--> Already Paid --> Escalate
          |
          +--> Dispute -------> Escalate
          |
          +--> Hardship ------> Escalate
          |
          +--> Do Not Call ---> Disposition
          |
          +--> Wrong Person --> Disposition
          |
          +--> Callback ------> Record Callback Request
          |
          v
      mark_disposition
          |
          v
         Close
```

## Currency Handling

Kapture Finance is treated as operating in India for this prototype.

All monetary values are spoken as Indian Rupees.

For example:

> 8,499 rupees

The assistant should not verbally say:

> $8,499

or:

> 8,499 dollars.

The underlying transcription/UI may display a currency symbol depending on formatting, but the intended spoken output is explicitly INR/rupees.

## Example Test Data

The prototype uses mock data:

| Field | Value |
|---|---|
| Customer | Rahul Sharma |
| Loan | Personal Loan |
| Overdue EMI | ₹8,499 |
| Days Past Due | 12 |
| Account ID | ACC-88392 |
| Verification Code | 1234 |
| Voice Agent | Maya |
| Company | Kapture Finance |

These values are test data only.

## Testing

The prototype was tested for:

- Successful customer verification
- Verification failure behavior
- Authentication bypass attempts
- Unauthorized protected-tool requests
- Successful promise-to-pay
- Payment-link request
- Already-paid claim
- Amount dispute
- Do-not-call request
- Spoken account-ID variations
- Public webhook connectivity
- Tool response formatting
- Final call disposition

See [`docs/test-results.md`](docs/test-results.md) for the detailed test matrix.

## Local Setup

From the repository root:

```powershell
cd mock-server
npm install
node server.js
```

The mock server runs on port `3000`.

In a second terminal:

```powershell
ngrok http 3000
```

Copy the HTTPS forwarding URL and configure the Vapi custom tools to use:

```text
https://<your-ngrok-domain>/webhook
```

## Direct Webhook Test

Example PowerShell test:

```powershell
curl -Method POST https://<your-ngrok-domain>/webhook `
  -ContentType "application/json" `
  -Body '{"message":{"type":"tool-calls","call":{"id":"connectivity-test-001"},"toolCallList":[{"id":"connectivity-tool-001","function":{"name":"verify_customer","arguments":{"account_id":"ACC-88392","verification_code":"1234"}}}]}}'
```

Expected successful result:

```json
{
  "results": [
    {
      "toolCallId": "connectivity-tool-001",
      "result": "{"verified":true,"customer_name":"Rahul Sharma"}"
    }
  ]
}
```

## Repository Structure

```text
kapture-collections-voicebot/
|
├── mock-server/
│   ├── server.js
│   ├── package.json
│   └── hld/
│       └── Kapture_Collections_Voicebot_HLD.docx
|
└── docs/
    ├── system-prompt.md
    └── test-results.md
```

## Prototype Limitations

This is intentionally a take-home prototype.

Production implementation would require:

- Real lending-system integration
- Production identity verification
- Persistent authentication/session storage
- Production payment-link service
- Real SMS/WhatsApp integration
- Secure secrets management
- Production telephony configuration
- Compliance/legal review
- Persistent do-not-call suppression
- Monitoring and alerting
- Automated regression testing
- Production-grade audit logging

## Future Improvements

Priorities for a production version:

1. Integrate with the real lending/customer systems.
2. Move authentication/session state to secure persistent storage.
3. Add robust English/Hindi switching.
4. Build automated evaluation and regression tests.
5. Add production observability dashboards.
6. Connect payment-link generation to a real payment service and delivery webhook.

## Documentation

The complete High-Level Design Document is available at:

`mock-server/hld/Kapture_Collections_Voicebot_HLD.docx`
