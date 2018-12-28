import * as expressive from "../index.ts";

const port = 3000;
const app = new expressive.App();
app.use(expressive.static_("./public"));
app.use(expressive.bodyParser.json());
app.get("/api/todos", async (req, res) => {
  res.json(todos);
});
app.post("/api/todos", async (req, res) => {
  const todo = {
    id: id++,
    name: req.data.name
  };
  todos.push(todo);
  res.json(todo);
});
app.get("/api/todos/{id}", async (req, res) => {
  res.json(todos[req.params.id]);
});
app.on("done", expressive.simpleLog());
app.listen(port, p => {
  console.log("app listening on port " + p);
});

const todos = [];
let id = 0;
