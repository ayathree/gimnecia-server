const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ycbv1lf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const userCollection = client.db('fitDB').collection('users')
    const trainerCollection = client.db('fitDB').collection('trainers')
// user
    app.get('/users',  async(req,res)=>{
     
      const result = await userCollection.find().toArray();
      res.send(result) 
    })

    app.post('/users', async(req,res)=>{
      const user= req.body;
      // dont let a user insert in db if it already exist
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message: 'user already exist', insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    // trainers
    app.get('/trainers', async(req,res)=>{
      const result = await trainerCollection.find().toArray();
      res.send(result)
  })

  app.post('/trainers', async(req,res)=>{
    const item = req.body;
    const query = {email: item.email}
      const existingItem = await trainerCollection.findOne(query);
      if(existingItem){
        return res.send({message: 'user already requested', insertedId: null})
      }
    const result = await trainerCollection.insertOne(item)
    res.send(result)
  })
  app.get('/trainers/:id',async(req,res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await trainerCollection.findOne(query)
    res.send(result)
  })
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);







app.get('/',(req,res)=>{
    res.send('fitness tracker')
})

app.listen(port,()=>{
    console.log(`fitness tracker running on port, ${port}`)
})