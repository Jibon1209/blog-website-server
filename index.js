const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

//middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uiabrwm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//middleware
const logger = async (req, res, next) => {
  console.log("called:", req.host, req.originalUrl);
  next();
};
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "not authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized" });
    }
    console.log("value in the token", decode);
    req.user = decode;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("blogDb").collection("users");
    const blogCollection = client.db("blogDb").collection("blogs");

    //auth api
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });
    app.post("/logout", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // user api
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const updatedDoc = {
        $set: {
          lastLoggedAt: user.lastLoggedAt,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //Blogs api
    app.get("/blogs", logger, async (req, res) => {
      const cursor = blogCollection.find().sort({ $natural: -1 }).limit(4);
      const result = await cursor.toArray();
      res.send(result);
    });
    // app.get("/blogs", logger, verifyToken, async (req, res) => {
    //   if (req.query.email !== req.user.email) {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }
    //   let query = {};
    //   if (req.query?.email) {
    //     query = { email: req.query.email };
    //   }
    //   const result = await blogCollection
    //     .find(query)
    //     .sort({ $natural: -1 })
    //     .limit(6)
    //     .toArray();
    //   res.send(result);
    // });
    app.post("/blogs", async (req, res) => {
      const newBlogs = req.body;
      const result = await blogCollection.insertOne(newBlogs);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`BlogDb Server Is running on port ${port}`);
});
