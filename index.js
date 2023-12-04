const express = require("express");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// middleware

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cmjacbf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const surveyCollection = client.db("survoDB").collection("surveys");
    const userCollection = client.db("survoDB").collection("users");
    const paymentCollection = client.db("survoDB").collection("payments");
    const feedbackCollection = client.db("survoDB").collection("feedbacks");

    // users
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    // app.get('/user', async (req, res) => {
    //   const user = req.body
    //   const query = {email: user.email}
    //   const result = await userCollection.find(query).toArray();
    //   res.send(result)
    // })
    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateRole = req.body;
      console.log(updateRole);
      const updatedDoc = {
        $set: {
          role: updateRole.role,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // jwt

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken= (req, res, next) =>{
      console.log(req.headers)
      next()

    }

    // surveys
    app.put("/surveys/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = req.body;
      console.log(update);
      const updatedDoc = {
        $set: {
          like: update.like,
          dislike: update.dislike,
          vote: update.vote,
        },
      };
      const result = await surveyCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/surveys", async (req, res) => {
      const result = await surveyCollection.find().toArray();
      res.send(result);
    });
    app.post("/surveys", async (req, res) => {
      const item = req.body;
      const result = await surveyCollection.insertOne(item);
      res.send(result);
    });
    app.patch("/surveys/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      // Example: Update only the title field if 'updateType' is provided in the request body
      // if (updateFields.updateType === 'title') {
      //   const updatedDoc = {
      //     $set: {
      //       title: updateFields.title,
      //     },
      //   };
      //   const result = await surveyCollection.updateOne(filter, updatedDoc);
      //   return res.send(result);
      // }
      const updatedDoc = {
        $set: {
          title: item.title,
          category: item.category,
          options: item.options,
          description: item.description,
        },
      };
      const result = await surveyCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.get("/surveys/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await surveyCollection.findOne(query);
      res.send(result);
    });
    app.delete("/surveys/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await surveyCollection.deleteOne(query);
      res.send(result);
    });
    // userFeedBacks
    app.post("/feedbacks", async (req, res) => {
      const item = req.body;
      const result = await feedbackCollection.insertOne(item);
      res.send(result);
    });
    app.get("/feedbacks", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });
    // payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log("payment info", payment);
      res.send(paymentResult);
    });
    // stats or analytics
    app.get("/admin-stats", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const surveys = await surveyCollection.estimatedDocumentCount();
      const proUser = await paymentCollection.estimatedDocumentCount();

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce(
        (total, payment) => total + payment.price,
        0
      );

      res.send({
        users,
        surveys,
        proUser,
        revenue,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
