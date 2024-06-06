const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
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
    const confirmedTrainerCollection =client.db('fitDB').collection('confirmedTrainers') 
    const bookedTrainerCollection = client.db('fitDB').collection('bookedTrainers')

    // jwt api
    app.post('/jwt', async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {expiresIn: '365d'}) 
      res.send({token})
    })
     // middleware
     const verifyToken=(req,res,next)=>{
      console.log('inside',req.headers.authorization)
      if (!req.headers.authorization) {
        return res.status(401).send({message:'forbidden access'})
        
      }
      const token = req.headers.authorization.split(' ')[1];
     
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded)=>{
        if (err) {
          return res.status(401).send({message: 'forbidden access'})
          
        }
        req.decoded= decoded;
        next()

      })

    }
    // verify admin after verify token
    const verifyAdmin = async (req,res,next)=>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role==='admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'})
      }
      next()
    }

// user
    app.get('/users', verifyToken,verifyAdmin,  async(req,res)=>{
     
      const result = await userCollection.find().toArray();
      res.send(result) 
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
    
      // Don't let a user insert in db if it already exists
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
    
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
    
      // Set role to 'member'
      user.role = 'member';
    
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    
    // admin
    app.patch('/users/admin/:id', async (req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set:{
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result)
    }) 
    app.get('/users/admin/:email', verifyToken, async(req,res)=>{
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({message: 'unauthorized access'})
        
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role=== 'admin';
        
      }
      res.send({ admin})

    })

    // trainers
    app.get('/trainers', verifyToken,verifyAdmin, async(req,res)=>{
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
  // confirmed trainer
  app.patch('/trainers/confirm/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

    try {
        const trainer = await trainerCollection.findOne(query);

        if (!trainer) {
            return res.status(404).json({ message: 'Trainer not found' });
        }

        console.log('Trainer found:', trainer);

        // Update trainer status in trainerCollection
        const updateTrainerResult = await trainerCollection.updateOne(query, { $set: { status: 'Trainer' } });
        console.log('updateTrainerResult:', updateTrainerResult);

        // Insert trainer into confirmedTrainerCollection with updated status
        const insertResult = await confirmedTrainerCollection.insertOne({ ...trainer, status: 'Trainer' });
        console.log('insertResult:', insertResult);

        // Update user role in userCollection
        const updateUserResult = await userCollection.updateOne({ email: trainer.email }, { $set: { role: 'trainer' } });
        console.log('updateUserResult:', updateUserResult);

        // Verify the role update
        const updatedUser = await userCollection.findOne({ email: trainer.email });
        console.log('updatedUser:', updatedUser);

        if (!updateUserResult.modifiedCount) {
            return res.status(400).json({ message: 'Failed to update user role' });
        }

        // Delete trainer from trainerCollection
        const deleteResult = await trainerCollection.deleteOne(query);
        console.log('deleteResult:', deleteResult);

        res.json({ message: 'Trainer confirmed and moved', trainer });
    } catch (error) {
        console.error('Error confirming trainer:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
  // get confirmed trainer
  app.get('/confirmedTrainer',  async(req,res)=>{
    const result = await confirmedTrainerCollection.find().toArray();
    res.send(result)
})
app.get('/users/trainer/:email', verifyToken, async (req, res) => {
  try {
    const email = req.params.email;

    // If the email in the request does not match the email in the token, return an unauthorized access message
    if (email !== req.decoded.email) {
      return res.status(403).send({ message: 'unauthorized access' });
    }

    const query = { email: email };
    
    const user = await userCollection.findOne(query);
    let trainer = false;

    if (user) {
      trainer = user?.role === 'trainer';
     }

    res.send({ trainer });
  } catch (error) {
    console.error('Error fetching member information:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});

app.get('/confirmedTrainer/:id',async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await confirmedTrainerCollection.findOne(query)
  res.send(result)
})
app.delete('/confirmedTrainer/:id',verifyToken, verifyAdmin, async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await confirmedTrainerCollection.deleteOne(query);
  res.send(result)
    })

  // trainers by time slot
  app.get('/trainee/:times', async (req, res) => {
    const availableTime = req.params.times;
    
    
    const query = { 'timeslot.times': availableTime };
    
    try {
        const result = await confirmedTrainerCollection.findOne(query);
        if (result) {
            res.send(result);
        } else {
            res.status(404).send({ message: 'No trainer found with the specified available time' });
        }
    } catch (error) {
        console.error('Error finding trainer:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

  // bookedTrainer
  app.get('/booked',  async(req,res)=>{
     
    const result = await bookedTrainerCollection.find().toArray();
    res.send(result) 
  })
  app.post('/booked', async(req,res)=>{
    const booked= req.body;
    // const query = {name: booked.name}
    //   const existingUser = await bookedTrainerCollection.findOne(query);
    //   if(existingUser){
    //     return res.send({message: 'user already exist', insertedId: null})
    //   }
    
    const result = await bookedTrainerCollection.insertOne(booked);
    res.send(result)
  })
  app.get('/booked/:email', async (req, res) => {
    const userEmail = req.params.email;
    const query = { userEmail: userEmail };
    const result = await bookedTrainerCollection.find(query).toArray(); 
    res.send(result);
  });
  // get booked details by id
  app.get('/bookeee/:id',async(req,res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await bookedTrainerCollection.findOne(query)
    res.send(result)
  })
  // member api
  app.get('/users/member/:email', verifyToken, async (req, res) => {
    try {
      const email = req.params.email;
  
      // If the email in the request does not match the email in the token, return an unauthorized access message
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' });
      }
  
      const query = { email: email };  
      const user = await userCollection.findOne(query);
      let member = false;
  
      if (user) {
        member = user?.role === 'member';
       }
  
      res.send({ member });
    } catch (error) {
      console.error('Error fetching member information:', error);
      res.status(500).send({ message: 'Internal server error' });
    }
  });
  
  



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