const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
let todoLists = require("./lib/seed-data");
const TodoList = require("./lib/todolist");

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
      // errorMsg: errors.array().map(error => error.msg),
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
  // Get the list ID from req.params.todoListId.
  // Use the todo list ID to retrieve the specified todo list object from todoLists.
  // The application should issue a 404 Not found. HTTP status code if no such list exists. (See the Hint.)
  let listId = req.params.todoListId

  let listToDisplay = todoLists.find(list => toString(list.id) == listId);
  console.log(todoLists[2].id);
  if (listToDisplay === undefined) {
    //issue error 404
    console.log('Error 404');
    res.errors('Error 404');
  } else {
    res.render("/list", {
      title: listToDisplay.title,
      todos: listToDisplay.todos
    });
  }
}
);

app.listen(PORT, (req, res) => {
  console.log(`Listening on port ${PORT} on ${HOST}`)
});



// app.post("/lists",
//   [
//     body("todoListTitle")
//       .trim()
//       .isLength({ min: 1 })
//       .withMessage("The list title is required.")
//       .isLength({ max: 100 })
//       .withMessage("List title must be between 1 and 100 characters.")
//       .custom(title => {
//         let duplicate = todoLists.find(list => list.title === title);
//         return duplicate === undefined;
//       })
//       .withMessage("List title must be unique."),
//   ],
//   (req, res) => {
//     let errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       errors.array().forEach(message => req.flash("error", message.msg));
//       res.render("new-list", {
//         flash: req.flash(),
//         todoListTitle: req.body.todoListTitle,
//       });
//     } else {
//       todoLists.push(new TodoList(req.body.todoListTitle));
//       req.flash("success", "The todo list has been created.");
//       res.redirect("/lists");
//     }
//   }
// );