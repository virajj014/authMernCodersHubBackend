const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const dotenv = require('dotenv');
dotenv.config();

const port = process.env.PORT


require('./db')

const allowedOrigins = [process.env.FRONTEND_URL]; // Add more origins as needed
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }))


app.use(bodyParser.json());
app.use(cookieParser({
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 1000 * 60 * 60 * 24 * 7,
  signed: true
}));


const authRoutes = require('./routes/authRoutes')
app.use('/auth', authRoutes)


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/getuserdata', (req, res) => {
  res.send('Harshal Jain , 45 , Male')
})
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})