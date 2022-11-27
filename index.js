const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middle ware
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
    res.send('Book Bin server is running')
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ex1o8oo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


//================== JWT verification function ===============================
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
        // All collections
        const categoriesCollection = client.db('bookBinDb').collection('categories')
        const productsCollection = client.db('bookBinDb').collection('products')
        const bookingsCollection = client.db('bookBinDb').collection('bookings')
        const usersCollection = client.db('bookBinDb').collection('users')
        const paymentsCollection = client.db('bookBinDb').collection('payments')


        //================ API for Stripe payments =====================
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.resalePrice;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

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



        // ========= admin check middleware =========
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            next()
        }

        // ======== seller Check middleware ===========
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            next()
        }
        // ======== buyer Check middleware ===========
        const verifyBuyer = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'buyer') {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            next()
        }



        // --------------------------- categories -----------------------------------
        app.get('/categories', async (req, res) => {
            const query = {}
            const categories = await categoriesCollection.find(query).toArray()
            res.send(categories)
        })

        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { categoryId: id }
            const result = await categoriesCollection.findOne(query)
            res.send(result)
        })

        app.get('/categories/allProducts/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { categoryId: id }
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })




        // --------------------------- products --------------------------------------
        app.get('/allProducts', async (req, res) => {
            const query = {}
            const products = await productsCollection.find(query).toArray()
            res.send(products)
        })

        app.get('/products', verifyToken, verifySeller, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const products = await productsCollection.find(query).toArray()
            res.send(products)
        })

        app.post('/products', verifyToken, verifySeller, async (req, res) => {
            const product = req.body
            const result = await productsCollection.insertOne(product)
            res.send(result)
        })

        app.put('/products/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    advertise: true
                },
            };
            const updateResult = await productsCollection.updateOne(filter, updateDoc, options)
            res.send(updateResult)
        })

        app.delete('/products/:id', verifyToken, verifySeller, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(query)
            res.send(result)
        })




        //---------------------------- bookings -------------------------------------
        app.get('/bookings', verifyToken, verifyBuyer, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })




        // api for check admin
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })

        })

        // api for check seller
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const seller = await usersCollection.findOne(query)
            res.send({ isSeller: seller?.role === 'seller' })
        })

        // api for check buyer
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const seller = await usersCollection.findOne(query)
            res.send({ isSeller: seller?.role === 'buyer' })
        })





        // ------------------------- Users -------------------------------------------
        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.put('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const user = await usersCollection.findOne(query)

            const filter = { email: user?.email }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    sellerVerified: true
                },
            };
            const updateResult = await productsCollection.updateMany(filter, updateDoc, options)
            res.send(updateResult)
        })

        app.put('/users/seller/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    isVerified: true
                },
            };
            const updateResult = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(updateResult)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })



        //------------- All sellers api
        app.get('/admin/allSellers/:email', async (req, res) => {
            const query = { role: 'seller' }
            const allSellers = await usersCollection.find(query).toArray()
            res.send(allSellers)
        })
        //------------- All buyers api
        app.get('/admin/allBuyers/:email', async (req, res) => {
            const query = { role: 'buyer' }
            const allBuyers = await usersCollection.find(query).toArray()
            res.send(allBuyers)
        })


        // -------------------- payments -------------------
        app.get('/dashboard/payment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const booking = await bookingsCollection.findOne(query)
            res.send(booking)
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment)
            const id = payment.bookingId;
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.put('/payments/:id', async(req, res) => {
            const id = req.params.id
            console.log(id)
            const filter = {_id: ObjectId(id)}
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    isSold: true
                },
            };
            const updateResult = await productsCollection.updateOne(filter, updateDoc, options)
            res.send(updateResult)
        })

    }
    finally {

    }
}
run().catch(error => console.log(error))





app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})