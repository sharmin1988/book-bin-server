const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
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

async function run(){
    try{
        const categoriesCollection = client.db('bookBinDb').collection('categories')
        const productsCollection = client.db('bookBinDb').collection('products')

        // --------------------------- categories -----------------------------------
        app.get('/categories', async(req, res) => {
            const query = {}
            const categories = await categoriesCollection.find(query).toArray()
            res.send(categories)
        })

        app.get('/categories/:id', async(req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = {categoryId: id}
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })

        // --------------------------- products --------------------------------------
        app.get('/products', async(req, res) => {
            const query = {}
            const products = await productsCollection.find(query).toArray()
            res.send(products)
        })

        

    }
    finally{

    }
}
run().catch(error => console.log(error))





app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})