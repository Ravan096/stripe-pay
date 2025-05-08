const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const https = require('https');
const StripeLib = require('stripe');
const dotenv = require("dotenv")
dotenv.config({ path: "config/config.env" })
const agent = new https.Agent({
  rejectUnauthorized: false
});

const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY, {
  httpClient: StripeLib.createNodeHttpClient(agent)
});

const app = express();
// const stripe = Stripe('');

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/payment', async (req, res) => {
  const { amount, id } = req.query; 

  // Validate the amount
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount." });
  }

  // Convert amount to paise (1 INR = 100 paise)
  const amountInPaise = amount * 100;

  try {
    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaise,  // amount is in paise (smallest currency unit)
      currency: 'inr',
    });

    // Send HTML for the payment form with the PaymentIntent client secret
    const html = `
        <!DOCTYPE html>
        <html>
          <head>
          <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Stripe Card Payment</title>
            <script src="https://js.stripe.com/v3/"></script>
            <style>
              body {
    font-family: Arial, sans-serif;
    padding: 20px;
    background-color: #f4f4f9;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    box-sizing: border-box;
  }

  .container {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  h2 {
    color: #333;
    text-align: center;
    margin-bottom: 20px;
    font-size: 1.5rem;
  }

  #card-element {
    margin: 20px 0;
    border: 1px solid #ccc;
    padding: 15px;
    border-radius: 4px;
    background-color: #fff;
  }

  #submit {
    width: 100%;
    background: #5469d4;
    color: white;
    padding: 12px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.3s ease;
  }

  #submit:hover {
    background: #3b4cca;
  }

  #error-message {
    color: red;
    margin-top: 10px;
    font-size: 14px;
    text-align: center;
  }

  @media (max-width: 480px) {
    h2 {
      font-size: 1.3rem;
    }

    .container {
      padding: 15px;
    }

    #card-element {
      padding: 12px;
    }

    #submit {
      font-size: 14px;
      padding: 10px;
    }
  }
            </style>
          </head>
          <body>
          <div class="container">
            <h2>Complete Payment</h2>
            <form id="payment-form">
              <div id="card-element"></div>
              <button id="submit">Pay ₹${amount}</button>
              <div id="error-message"></div>
            </form>
            </div>
    
            <script>
              const stripe = Stripe("${process.env.PublishableKey}"); // your publishable key
              const elements = stripe.elements();
              const card = elements.create("card");
              card.mount("#card-element");
    
              const form = document.getElementById("payment-form");
            //   const id = "${id}";
              const amount = "${amount}";
    
              form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const { error } = await stripe.confirmCardPayment("${paymentIntent.client_secret}", {
                  payment_method: { card: card }
                });
    
                if (error) {
                  document.getElementById("error-message").textContent = error.message;
                   callExternalAPI("${id}",amount,"failed");
                } else {
                  alert("Payment successful! Your payment ID is: ${paymentIntent.id}");
                callExternalAPI("${id}",amount,"succeeded");
                }
              });

              function callExternalAPI(id, amount, status,) {
                const apiUrl = "https://prod-19.centralindia.logic.azure.com:443/workflows/5b34127eca4543cc8276f2fb10414dd0/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=nKMcHejj8FCFMALqrgkwL-CbnL4wQpkQnRYrzDtL0ls";
                
                fetch(apiUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    id: id, 
                    amount: amount,
                    status:status 
                  }),
                })
                .then(response => response.json())
                .then(data => {
                  console.log("API Response:", data);
                })
                .catch(error => {
                  console.error("Error calling external API:", error);
                });
              }
            </script>
          </body>
        </html>
        `;

    res.send(html);
  } catch (err) {
    console.error('Error creating PaymentIntent:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/v1/create-payment', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});


app.post('/api/v1/update-transaction', async (req, res) => {
  const { paymentIntentId, amount } = req.body;

  if (!paymentIntentId || !amount) {
    return res.status(400).json({ error: 'paymentIntentId and amount are required' });
  }

  try {
    const updatedPaymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
      amount: amount,
    });
    res.json(updatedPaymentIntent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
