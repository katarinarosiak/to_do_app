const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
let todoLists = require("./lib/seed-data");
const TodoList = require("./lib/todolist");
const Todo = require("./lib/todo");

const store = require("connect-loki");

const app = express();
const HOST = "localhost";
const PORT = 3000;
const LokiStore = store(session);

const compareListTitles = (firstList, secondList) => {
  if (firstList.isDone()) {
    return 1;
  } else {
    if (firstList.title.toLowerCase() > secondList.title.toLowerCase()) {
      return 1;
    } else {
      return -1;
    }
  }
}

const createValidatorChain = (name) => {
  return [body(name)
    .trim()
    .isLength({ min: 1 })
    .withMessage("The list name should be at least one character long")
    .isLength({ max: 100 })
    .withMessage("The list's name should be no longer than 100 characters")
  ];
};

const retriveListById = (todoLists, listId) => todoLists.find(list => list.id === Number(listId));

const retriveTodoById = (todoList, todoId) => todoList.todos.find(todo => todo.id === Number(todoId));

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name: "todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
}));

app.use(flash());

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
    todoLists: todoLists.sort(compareListTitles)
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
    todoLists.push(new TodoList(todoListTitle));
    req.flash("success", "The todo list has been created.");
    res.redirect('/lists');
  }
}
);

app.get('/lists/:todoListId', (req, res, next) => {

  let listId = req.params.todoListId

  let todoList = retriveListById(todoLists, listId)
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
  let todoList = retriveListById(todoLists, todoListId);
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
  let todoList = retriveListById(todoLists, todoListId);
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
  let todoList = retriveListById(todoLists, todoListId);

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
  let todoList = retriveListById(todoLists, todoListId);
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

app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

app.listen(PORT, (req, res) => {
  console.log(`Listening on port ${PORT} on ${HOST}`)
});
