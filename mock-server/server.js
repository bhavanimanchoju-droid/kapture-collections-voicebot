const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Demo customer record.
// In production this would come from a secure database/service.
const customer = {
  account_id: "ACC-88392",
  name: "Rahul Sharma",
  loan_type: "Personal Loan",
  overdue_amount: 8499,
  days_past_due: 12,
  verification_code: "1234"
};

// Simple in-memory authentication state for the demo.
// Key = Vapi call/session ID.
const sessions = new Map();

function getSessionId(message) {
  return message?.call?.id || message?.call?.callId || message?.sessionId;
}

function isAuthenticated(sessionId, accountId) {
  if (!sessionId) {
    return false;
  }

  const session = sessions.get(sessionId);

  return (
    session?.authenticated === true &&
    session?.account_id === accountId
  );
}

function toolResult(toolCallId, result) {
  return {
    results: [
      {
        toolCallId,
        result: JSON.stringify(result)
      }
    ]
  };
}

app.get("/", (req, res) => {
  res.json({
    service: "Kapture Collections Mock Server",
    status: "running"
  });
});

app.post("/webhook", (req, res) => {
  const { message } = req.body;

  console.log("\nIncoming request:");
  console.log(JSON.stringify(req.body, null, 2));

  if (!message) {
    return res.status(400).json({
      error: "Missing message in request"
    });
  }

  if (message.type !== "tool-calls") {
    return res.status(200).json({
      message: "Request received but no tool call was provided"
    });
  }

  const toolCall = message.toolCallList?.[0];

  if (!toolCall) {
    return res.status(400).json({
      error: "No tool call found"
    });
  }

  const toolName = toolCall.function?.name;
  const parameters = toolCall.function?.arguments || {};
  const sessionId = getSessionId(message);

  console.log("Tool:", toolName);
  console.log("Parameters:", parameters);
  console.log("Session ID:", sessionId || "not provided");

  // ---------------------------------------------------------
  // 1. VERIFY CUSTOMER
  // ---------------------------------------------------------
  if (toolName === "verify_customer") {
    const accountId = parameters.account_id;
    const verificationCode = parameters.verification_code;

    const verified =
      accountId === customer.account_id &&
      verificationCode === customer.verification_code;

    if (verified && sessionId) {
      sessions.set(sessionId, {
        authenticated: true,
        account_id: accountId
      });

      console.log("Authentication successful for session:", sessionId);

      return res.json(
        toolResult(toolCall.id, {
          verified: true,
          customer_name: customer.name
        })
      );
    }

    console.log("Authentication failed.");

    return res.json(
      toolResult(toolCall.id, {
        verified: false,
        reason: "Verification failed"
      })
    );
  }

  // ---------------------------------------------------------
  // ALL TOOLS BELOW THIS POINT REQUIRE AUTHENTICATION
  // ---------------------------------------------------------

  const accountId = parameters.account_id;

  if (!isAuthenticated(sessionId, accountId)) {
    console.log("Blocked protected tool: customer is not authenticated.");

    return res.status(200).json({
        results: [
            {
            toolCallId: toolCall.id,
            error: "NOT_AUTHENTICATED: Customer verification is required before this action."
            }
        ]
        });
  }

  // ---------------------------------------------------------
  // 2. LOG PROMISE TO PAY
  // ---------------------------------------------------------
  if (toolName === "log_promise_to_pay") {
    const ptpDate = parameters.ptp_date;
    const amount = parameters.amount;

    console.log("Logging promise to pay:");
    console.log({
      accountId,
      ptpDate,
      amount
    });

    return res.json(
      toolResult(toolCall.id, {
        success: true,
        ptp_id: "PTP-4821",
        account_id: accountId,
        committed_date: ptpDate,
        committed_amount: amount
      })
    );
  }

  // ---------------------------------------------------------
  // 3. SEND PAYMENT LINK
  // ---------------------------------------------------------
  if (toolName === "send_payment_link") {
    const channel = parameters.channel;

    console.log("Sending payment link:");
    console.log({
      accountId,
      channel
    });

    return res.json(
      toolResult(toolCall.id, {
        success: true,
        channel,
        message: "Payment link sent successfully."
      })
    );
  }

  // ---------------------------------------------------------
  // 4. MARK DISPOSITION
  // ---------------------------------------------------------
  if (toolName === "mark_disposition") {
    const status = parameters.status;
    const notes = parameters.notes || "";

    console.log("Recording disposition:");
    console.log({
      accountId,
      status,
      notes
    });

    return res.json(
      toolResult(toolCall.id, {
        success: true,
        disposition_logged: true,
        account_id: accountId,
        status
      })
    );
  }

  // ---------------------------------------------------------
  // 5. ESCALATE TO HUMAN AGENT
  // ---------------------------------------------------------
  if (toolName === "escalate_to_agent") {
    const reason = parameters.reason;

    console.log("Escalating to human agent:");
    console.log({
      accountId,
      reason
    });

    return res.json(
      toolResult(toolCall.id, {
        success: true,
        escalation_id: "ESC-1001",
        reason
      })
    );
  }

  // ---------------------------------------------------------
  // UNKNOWN TOOL
  // ---------------------------------------------------------
  return res.status(400).json({
    error: `Unknown tool: ${toolName}`
  });
});

app.listen(PORT, () => {
  console.log(`Kapture Collections Mock Server running on port ${PORT}`);
});