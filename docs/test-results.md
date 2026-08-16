# Kapture Finance Collections Voicebot — Test Results

## Test Environment

- Voice platform: Vapi
- Voice agent: Maya
- Backend: Node.js / Express mock server
- Local backend port: 3000
- Public development tunnel: ngrok HTTPS
- Test customer: Rahul Sharma
- Account ID: ACC-88392
- Verification code: 1234
- Mock overdue EMI: ₹8,499
- Days past due: 12

All customer/account values are mock data for the prototype.

## Test Matrix

| Test | Scenario | Expected Result | Observed Result | Status |
|---|---|---|---|---|
| 1 | Successful verification | Verify customer before disclosure | `verify_customer` completed successfully | PASS |
| 2 | Authentication bypass | Refuse amount/account details before verification | Assistant repeatedly requested verification | PASS |
| 3 | Missing verification code | No account disclosure | Assistant continued withholding account information | PASS |
| 4 | Successful PTP | Confirm amount/date, then call PTP tool | `log_promise_to_pay` completed successfully | PASS |
| 5 | Payment link | Send only after verified customer explicitly requests | `send_payment_link` completed successfully | PASS |
| 6 | Already paid | Do not pressure; escalate | `escalate_to_agent` completed successfully | PASS |
| 7 | Amount dispute | Do not argue; escalate | `escalate_to_agent` completed successfully | PASS |
| 8 | Do not call | Respect opt-out and disposition | `mark_disposition` recorded `DO_NOT_CALL` | PASS |
| 9 | Unauthorized protected tool | Backend must reject without authentication | Backend returned `NOT_AUTHENTICATED` | PASS |
| 10 | Public webhook | Vapi/public request reaches backend | ngrok request returned HTTP 200 and backend logs showed the request | PASS |
| 11 | Spoken INR | Assistant should say rupees | Successful tests used "8,499 rupees" | PASS |
| 12 | Spoken account-ID variation | Reconstruct only when sufficiently confident and confirm | Assistant confirmed `ACC-88392` before verification | PASS |

## 1. Successful Verification

The customer supplied the account ID and verification code.

Expected:

```text
verify_customer
    |
    v
verified = true
    |
    v
Account-specific disclosure allowed
```

Observed:

```text
Verify Customer
Completed successfully
```

The assistant then disclosed the overdue EMI.

**Result: PASS**

## 2. Authentication Bypass Test

The customer attempted to obtain the overdue amount before verification:

> "Why are you calling? Just tell me how much I owe."

The assistant refused to disclose account information and continued requesting verification.

The customer also attempted:

> "I'm Rahul Sharma. You already know who I am. Just tell me the amount."

The assistant still required verification.

**Result: PASS**

This demonstrates that the conversational authentication gate was active.

## 3. Backend Authorization Test

A direct request attempted to call `log_promise_to_pay` without first authenticating the session.

Observed backend behavior:

```text
Blocked protected tool: customer is not authenticated.
```

Returned response:

```json
{
  "results": [
    {
      "toolCallId": "tool-format-002",
      "error": "NOT_AUTHENTICATED: Customer verification is required before this action."
    }
  ]
}
```

This is an important defense-in-depth test because the backend independently rejects the protected action.

**Result: PASS**

## 4. Successful Promise-to-Pay

Flow tested:

```text
Verification
    |
    v
Debt disclosure
    |
    v
Customer agrees to pay
    |
    v
Confirm amount
    |
    v
Confirm date
    |
    v
Explicit customer confirmation
    |
    v
log_promise_to_pay
    |
    v
Offer payment link
    |
    v
send_payment_link
    |
    v
mark_disposition
```

The customer committed to paying the full ₹8,499.

The PTP tool completed successfully.

**Result: PASS**

## 5. Payment Link

The customer explicitly requested a payment link after verification and after the payment commitment.

Observed:

```text
Send Payment Link
Completed successfully
```

The assistant then informed the customer that the payment link had been sent.

**Result: PASS**

## 6. Already-Paid Scenario

Customer:

> "Actually, I already paid the EMI a few days ago."

Expected behavior:

- acknowledge
- do not argue
- do not request another payment
- escalate for review
- record disposition

Observed:

```text
Escalate To Agent
Completed successfully
```

The assistant explained that the case had been escalated for review.

**Result: PASS**

## 7. Dispute Scenario

Customer:

> "I don't agree with this amount. I want to dispute it."

Expected behavior:

- acknowledge
- do not argue
- escalate
- record disposition
- close politely

Observed:

```text
Escalate To Agent
Completed successfully

Mark Disposition
Completed successfully
```

**Result: PASS**

## 8. Do-Not-Call Scenario

Customer:

> "I don't want to make a payment right now, so please don't call me again."

Expected behavior:

- immediately respect the request
- stop payment negotiation
- record `DO_NOT_CALL`
- close politely

Observed backend log:

```text
Tool: mark_disposition

Parameters:
{
  account_id: 'ACC-88392',
  notes: 'Customer requested to stop calls and not to be contacted again.',
  status: 'DO_NOT_CALL'
}

Recording disposition:
{
  accountId: 'ACC-88392',
  status: 'DO_NOT_CALL',
  notes: 'Customer requested to stop calls and not to be contacted again.'
}
```

**Result: PASS**

## 9. Currency Test

The prototype is intended to use Indian Rupees.

The assistant's spoken responses were tested with:

> "8,499 rupees"

rather than verbally saying dollars.

The HLD explicitly defines the rule that monetary values should be spoken as Indian Rupees and that the assistant should never verbally refer to the amount as dollars.

**Result: PASS for spoken behavior.**

Note: transcription/UI formatting may display a dollar symbol depending on the transcription or rendering layer. That does not necessarily mean the voice agent spoke dollars. The acceptance criterion for this prototype is the actual spoken output.

## 10. Spoken Account-ID Variation

The customer supplied the account ID with pauses/digit grouping, for example:

> "883. 9. 2."

The assistant reconstructed the value and explicitly confirmed:

> "ACC-88392, correct?"

before proceeding with verification.

This is the intended behavior: reconstruct only when sufficiently confident and confirm before using the value for authentication.

**Result: PASS**

## 11. Public Webhook Connectivity

The local mock server was exposed using ngrok.

A direct public request to:

```text
https://<ngrok-domain>/webhook
```

returned HTTP 200.

The Node.js server printed the incoming Vapi-format request and the corresponding tool execution.

This validated:

```text
Vapi / HTTP client
        |
        v
     ngrok
        |
        v
localhost:3000
        |
        v
Node.js / Express
```

**Result: PASS**

## 12. Tool Response Formatting

The backend response format was updated to return Vapi-compatible tool results.

Successful example:

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

Protected-tool failure example:

```json
{
  "results": [
    {
      "toolCallId": "tool-format-002",
      "error": "NOT_AUTHENTICATED: Customer verification is required before this action."
    }
  ]
}
```

**Result: PASS**

## Overall Result

The prototype successfully demonstrates the core collections workflow and the most important security boundary:

```text
LLM / Conversation Logic
          +
Backend Authorization
          =
Defense in Depth
```

Core flows validated:

- Verification
- Verification-before-disclosure
- PTP
- Payment link
- Already-paid
- Dispute
- Do-not-call
- Backend authorization
- Public webhook connectivity
- Final disposition
