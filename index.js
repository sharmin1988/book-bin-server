const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000

// Middle ware
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
    res.send('Book Bin server is running')
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ex1o8oo.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// JWT verification function
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded
        next()
    })
}

async function run() {
    try {
        const categoriesCollection = client.db('bookBinDb').collection('categories')
        const productsCollection = client.db('bookBinDb').collection('products')
        const bookingsCollection = client.db('bookBinDb').collection('bookings')
        const usersCollection = client.db('bookBinDb').collection('users')

        // ======== jwt ==========
        app.get('/jwt', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '3h' })
                return res.send({ access_token: token })
            }
            return res.status(403).send({ access_token: '' })
        })

        // --------------------------- categories -----------------------------------
        app.get('/categories', async (req, res) => {
            const query = {}
            const categories = await categoriesCollection.find(query).toArray()
            res.send(categories)
        })

        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { categoryId: id }
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })

        // ---------------------------all products --------------------------------------
        app.get('/products', async (req, res) => {
            const query = {}
            const products = await productsCollection.find(query).toArray()
            res.send(products)
        })

        //---------------------------- bookings -------------------------------------
        app.get('/bookings', verifyToken, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ message: 'Forbidden access!!!' })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query)
            console.log(user)

            if(user?.role !== 'buyer'){
                return res.status(403).send({ message: 'Forbidden access!!! u are not a buyer' })
            }
            const result = await bookingsCollection.find(query).toArray()
            // console.log(result)
            res.send(result)

        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })


        // ------------------------- users -------------------------------------------

        // api for check admin
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })

        })

        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })



    }
    finally {

    }
}
run().catch(error => console.log(error))





app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})