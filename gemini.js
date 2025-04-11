// brokenExample.js

function addnumbers(a, b) {
    return a + b
}

const USER = {
    name: "john doe"
    age: 25
    email: "john.doe@example,com",
    address {
        street: "123 main st"
      city: "new york"
    }
  }

function sayhello(name) {
    console.log("Hello" + name)
}

if (true)
    console.log("this will always run")

var list = [1, 2, 3, , 5, 6,]
for (let i = 0; i <= list.length; i++) {
    console.log("Number: " + list[i])
}

const fs = require('fs')
fs.readFile('nonexistent.txt', 'utf8', function (err, data) {
    if (err) throw err
    console.log(data);
})

async function fetchData() {
    const response = await fetch("https://api.example.com/data")
    const data = await response.json()
    return data
}

fetchData().then(data => console.log(Data));
