import express from 'express';
import User from './Models/User.js'; // Adjust the path based on your directory structure
import bcrypt from 'bcrypt';
import crypto from 'crypto'; // Import the 'crypto' module
import jwt from 'jsonwebtoken'; // Import the jsonwebtoken library
import nodemailer from 'nodemailer';
const app = express();
const port = process.env.PORT || 8000; // Use process.env.PORT for flexibility
import cors from 'cors'
const SECRET = process.env.SECRET || "topsecret";
import cookieParser from 'cookie-parser';
import multer from 'multer';
import bucket from './Bucket/Firebase.js';
import fs from 'fs';
import { ProductModel } from './Models/User.js';
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }))
app.use(cors({
  origin: ['http://localhost:3000', "*"],
  credentials: true
}));
app.use(express.json());


const storageConfig = multer.diskStorage({
  destination: './uploads',
  filename: function (req, file, cb) {

      console.log("mul-file: ", file);
      cb(null, `${new Date().getTime()}-${file.originalname}`)
  }
})
var uploadMiddleware = multer({ storage: storageConfig })


// Define a basic route
app.get('/', (req, res) => {
  res.send('Hello, Express with ES6!');
});


// app.post('/api/v1/AddProduct', uploadMiddleware.any(), (req, res) => {
//   // req.body will contain the non-file fields you sent, like Name, Price, Description, etc.
//   const { Name, Price, Description, category } = req.body;
//   const files = req.body.Image;
//   // req.files will contain an array of uploaded files
//   // You can now use the data you received and perform further processing or save to a database
//   console.log('Name:', Name);
//   console.log('Price:', Price);
//   console.log('Description:', Description);
//   console.log('Category:', category);
//   const imageUrls = files.split(',');
//   console.log(imageUrls);
//   console.log(imageUrls.filename);




  







// })
  
 



app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user with the given email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Create a new user
    const newUser = new User({
      username,
      email,
      password,
    });

    // Save the user to the database
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/login', async (req, res) => {
  try {
    let body = req.body;
    body.email = body.email.toLowerCase();

    if (!body.email || !body.password) {
      res.status(400).send(`required fields missing, request example: ...`);
      return;
    }

    // check if user exists
    const data = await User.findOne({ email: body.email }, "username email password");

    if (data && body.password === data.password) { // user found
      console.log("data: ", data);

      const token = jwt.sign({
        _id: data._id,
        email: data.email,
        iat: Math.floor(Date.now() / 1000) - 30,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
      }, SECRET);

      console.log("token: ", token);

      res.cookie('Token', token, {
        maxAge: 86_400_000,
        httpOnly: true,
        sameSite: 'none',
        secure: true
      });

      res.send({
        message: "login successful",
        profile: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          age: data.age,
          _id: data._id
        }
      });

      return;


    }
    else { // user not found
      console.log("user not found");
      res.status(401).send({ message: "Incorrect email or password" });
    }
  } catch (error) {
    console.log("error: ", error);
    res.status(500).send({ message: "login failed, please try later" });
  }
});

app.use('/api/v1', (req, res, next) => {

  console.log("req.cookies: ", req.cookies.Token);

  if (!req?.cookies?.Token) {
    res.status(401).send({
      message: "include http-only credentials with every request"
    })
    return;
  }

  jwt.verify(req.cookies.Token, SECRET, function (err, decodedData) {
    if (!err) {

      console.log("decodedData: ", decodedData);

      const nowDate = new Date().getTime() / 1000;

      if (decodedData.exp < nowDate) {

        res.status(401);
        res.cookie('Token', '', {
          maxAge: 1,
          httpOnly: true,
          sameSite: 'none',
          secure: true
        });
        res.send({ message: "token expired" })

      } else {

        console.log("token approved");

        req.body.token = decodedData
        next();
      }
    } else {
      res.status(401).send("invalid token")
    }
  });
})
app.get('/api/v1/profile', (req, res) => {
  const _id = req.body.token._id
  const getData = async () => {
    try {
      const user = await User.findOne({ _id: _id }, "email password username -_id").exec()
      if (!user) {
        res.status(404).send({})
        return;
      } else {

        res.set({
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "Surrogate-Control": "no-store"
        });
        res.status(200).send(user)
      }

    } catch (error) {

      console.log("error: ", error);
      res.status(500).send({
        message: "something went wrong on server",
      });
    }

  }
  getData()
})


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
