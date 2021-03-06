const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");

const TodoList = require("./lib/todolist");
const Todo = require("./lib/todo");
const { sortTodoLists, sortTodos } = require("./lib/sort");

const store = require("connect-loki");

const app = express();
const HOST = "localhost";
const PORT = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(flash());

app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in milliseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-to-do-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));


app.use((req, res, next) => {
  let todoLists = [];
  if ("todoLists" in req.session) {
    req.session.todoLists.forEach(todoList => {
      todoLists.push(TodoList.makeTodoList(todoList));
    });
  }

  req.session.todoLists = todoLists;
  next();
});



const retriveListById = (todoLists, listId) => todoLists.find(list => list.id === Number(listId));

const retriveTodoById = (todoList, todoId) => todoList.todos.find(todo => todo.id === Number(todoId));



app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});


app.get('/', (req, res) => {
  res.redirect('lists');
})

app.get('/lists', (req, res) => {
  res.render('lists', {
    todoLists: sortTodoLists(req.session.todoLists)
  });
});

app.get('/lists/new', (req, res) => {
  res.render('new-list');
})

app.post('/lists', [
  body("todoListTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("The list name should be at least one character long")
    .isLength({ max: 80 })
    .withMessage("The list's name should be no longer than 80 characters")
], (req, res) => {
  let errors = validationResult(req);
  if (!errors.isEmpty()) {
    errors.array().forEach(message => req.flash("error", message.msg));
    res.render('new-list', {
      flash: req.flash(),
      todoListTitle: req.body.todoListTitle,
    });
  } else {
    let todoListTitle = req.body.todoListTitle
    req.session.todoLists.push(new TodoList(todoListTitle));
    req.flash("success", "The todo list has been created.");
    res.redirect('/lists');
  }
}
);

app.get('/lists/:todoListId', (req, res, next) => {

  let listId = req.params.todoListId

  let todoList = retriveListById(req.session.todoLists, listId)
  if (todoList === undefined) {

    let err = new Error();
    err.status = 400;
    next(new Error('Not found'));
  } else {
    res.render("list", {
      todoList: todoList,
      todos: todoList.todos
    });
  }
}
);


app.post('/lists/:todoListId/todos/:todoId/toggle', (req, res, next) => {

  let todoListId = req.params.todoListId
  let todoId = req.params.todoId;
  let todoList = retriveListById(req.session.todoLists, todoListId);
  let todo = retriveTodoById(todoList, todoId);

  if (todoList === undefined || todo === undefined) {
    let err = new Error();
    err.status = 400;
    next(new Error('Not found'));
  } else {
    let title = todo.title;
    if (todo.done) {
      todo.markUndone();
      req.flash("success", `"${title}" marked as NOT done!`);
    } else {
      todo.markDone();
      req.flash("success", `"${title}" marked done.`);
    }
    // res.render('list');
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post('/lists/:todoListId/todos/:todoId/destroy', (req, res, next) => {

  let todoListId = req.params.todoListId
  let todoId = req.params.todoId;
  let todoList = retriveListById(req.session.todoLists, todoListId);
  let todo = retriveTodoById(todoList, todoId);

  if (todoList === undefined || todo === undefined) {
    let err = new Error();
    err.status = 400;
    next(new Error('Not found'));
  } else {
    let title = todo.title;
    todoList.removeAt(todoList.findIndexOf(todo));
    req.flash("success", `"${title}" has been removed!`);
    res.redirect(`/lists/${todoListId}`);
  }
})

app.post('/lists/:todoListId/complete_all', (req, res, next) => {
  let todoListId = req.params.todoListId
  let todoList = retriveListById(req.session.todoLists, todoListId);

  if (todoList === undefined) {
    let err = new Error();
    err.status = 400;
    next(new Error('Not found'));
  } else {
    todoList.markAllDone();
    req.flash("success", `"All the todos has been completed."`);
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post('/lists/:todoListId/todos', [
  body("todoTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("The todo's name should be at least one character long")
    .isLength({ max: 100 })
    .withMessage("The todo's name should be no longer than 80 characters")
], (req, res, next) => {
  let todoListId = req.params.todoListId
  let todoList = retriveListById(req.session.todoLists, todoListId);
  let todoTitle = req.body.todoTitle;
  let errors = validationResult(req);

  if (todoList === undefined) {
    let err = new Error();
    err.status = 400;
    next(new Error('Not found'));
  } else if (!errors.isEmpty()) {
    errors.array().forEach(message => req.flash("error", message.msg));
    res.render(`list`, {
      flash: req.flash(),
      todoTitle: req.body.todoTitle,
      todos: todoList.todos,
      todoList: todoList
    });
  } else {
    let newTodo = new Todo(todoTitle);
    todoList.add(newTodo);
    req.flash('New to do has been addedd succesfully.');
    res.redirect(`/lists/${todoListId}`);
  }
});

app.get('/lists/:todoListId/edit', (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = retriveListById(req.session.todoLists, todoListId);

  if (todoList === undefined) {
    let err = new Error();
    err.status = 400;
    next(new Error('Not found'));
  } else {
    res.render('edit-list', { todoList });
  }
});

app.post('/lists/:todoListId/destroy', (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = retriveListById(req.session.todoLists, todoListId);
  let index = req.session.todoLists.findIndex(todoList => todoList.id === todoListId);

  if (todoList === undefined) {
    let err = new Error();
    err.status = 400;
    next(new Error('Not found'));
  } else {
    req.session.todoLists.splice(index, 1)
    req.flash("success", 'To do list delated');
    res.redirect('/lists');
  }
})

app.post('/lists/:todoListId/edit',
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list name should be at least one character long")
      .isLength({ max: 100 })
      .withMessage("The list's name should be no longer than 80 characters")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage('List title must be uniqye.'),
  ], (req, res, next) => {
    let todoListId = req.params.todoListId;
    let todoList = retriveListById(req.session.todoLists, todoListId);
    let errors = validationResult(req);

    if (todoList === undefined) {
      let err = new Error();
      err.status = 400;
      next(new Error('Not found'));
    } else if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      res.render('edit-list', {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
        todoList: todoList,
      });
    } else {
      todoList.setTitle(req.body.todoListTitle);
      req.flash("success", 'The title has been updated');
      res.redirect(`/lists/${todoListId}`);
    }
  })


app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

app.listen(PORT, (req, res) => {
  console.log(`Listening on port ${PORT} on ${HOST}`)
});


//doesnt work cancel and change title a