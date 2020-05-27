require('dotenv').config()

const Nexmo = require('nexmo')
const nexmo = new Nexmo({
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
    applicationId: process.env.APPLICATION_ID,
    privateKey: process.env.PRIVATE_KEY_FILE
})

var text = 'hola mundo'

// // enviando mensaje
nexmo.message.sendSms(
    process.env.FROM_NUMBER, 
    process.env.TO_NUMBER, 
    text, 
    {
        type: "unicode"
    }, 
    (err, responseData) => {
        if (err) {
            console.log(err);
        } 
        else {
            if (responseData.messages[0]['status'] === "0") {
                console.log("Message sent successfully.");
            } 
            else {
                console.log(`Message failed with error: ${responseData.messages[0]['error-text']}`);
            }
        }
    }
)

// nexmo.channel.send(
//     { "type": "sms", "number": process.env.TO_NUMBER },
//     { "type": "sms", "number": process.env.FROM_NUMBER },
//     {
//       "content": {
//         "type": "text",
//         "text": "This is an SMS sent from the Messages API"
//       }
//     },
//     (err, data) => { console.log(data.message_uuid); }
// )


const express = require('express')
const bodyParser = require('body-parser')

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))


// inbound message websocket handler
app.post('/webhooks/inbound-message', (req, res) => {
  console.log(req.body)
  res.status(200).end()
})


// message status websocket handler
app.post('/webhooks/message-status', (req, res) => {
    console.log(req.body)
    res.status(200).end()
})

app.listen(80) // port listening