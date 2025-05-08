const app = require('./app');

const server = app;


server.listen(process.env.PORT, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT}`)
});


// module.exports = { userSocketIds }