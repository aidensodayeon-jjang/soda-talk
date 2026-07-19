const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: "user-1", username: "admin" }, process.env.JWT_SECRET || "soda_secret_key");
fetch('http://localhost:7989/api/admin/chats', {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
