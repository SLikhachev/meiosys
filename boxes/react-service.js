
// help functions to control streams
const e = React.createElement;

const I = x => x; // identity

// Patcher - func return the patch func of the current state
const P = patch => state => Object.assign(state, patch);

// lift up the update stream
const lift = update => patch => update(P(patch));

// infinite cycle drop guard function
const dropRepeats = (states, onchange = I) => {
  let prev = undefined;
  const result = m.stream();

  // мы связали поток states таким образм,
  // что если состояние изменилось, то текущее измененное
  // состояние будет записано в поток result,
  // иначе поток result не изменится.
  states.map(state => {
    const next = onchange(state);
    if (next !== prev) {
      prev = next;
      result(state);
    }
  });
  // фактически это замыкание для потока result
  return result;
};

// utils for description string
const humanList = s => xs => xs.length > 1 ?
  `${xs.slice(0, -1).join(", ")} ${s} ${xs.slice(-1)}` :
  xs.join("");

const descString = R.pipe(
  R.toPairs,
  R.groupBy(R.last),
  R.map(R.map(R.head)),
  R.map(humanList("and")),
  R.toPairs,
  R.map(R.join(" ")),
  humanList("and"),
  x => x + "."
)

// react components
// home
const HomeView = function(props) {

  const login = evt => props.cell.disp(['login', evt]);

  return e("div", {className: "app"},
    e("nav", {className:"header"},
      e("h1", null, "Boxes"),
      e('a', { href: '#' }, 'Домой'),
      e('a', { href: '#', onClick: login }, 'Войти')
    ),
    e('h2', {className: 'cent'},
      "Чтобы поиграть в кубики нужно залогиниться")
  )
}
// login
const LoginView = function(props) {

  const home = evt => props.cell.disp(['home', evt]);
  const change = evt => props.cell.disp(['changeForm', evt])
  const submit = evt => props.cell.disp(['play', evt])

  return e("div", {className: "app"},
    e("nav", {className:"header"},
      e("h1", null, "Boxes"),
      e('a', { href: '#', onClick: home}, 'Домой'),
    ),
    e('form', {className: 'cent', onSubmit: submit},
      e('legend', null, "Форма входа: любой текст в полях правильный"),
      e('input',
        { name: 'username', type: 'text', required: true, placeholder: "username",
          onChange: change
      }),
      e('input',
        { name: 'password', type: 'password', required: true, placeholder: "password",
          onChange: change
      }),
      e('input', { type: 'submit', value: "Войти"} )
    )
  )
}
// play
const PlayView = function(props) {
  const cell = props.cell;
  const _add = (evt, color) => {
    evt.preventDefault();
    return cell.disp(['addBox', color])
  }
  const _remove = (evt, idx) => {
    evt.preventDefault();
    return cell.disp(['removeBox', idx])
  }
  const logout = evt => cell.disp(['logout', evt])

  return e("div", {className: "app"},
    e("nav", {className:"header"},
      e("h1", null, "Boxes"),
      cell.state.colors.map(color =>
        e("button", {
            style: {'backgroundColor': `${color}`},
            onClick: evt => _add(evt, `${color}`)
          }, "+"
        )
      ),
      e('a', { href: '#', onClick: logout }, "Выйти")
    ),
    e("p", null, cell.state.description),
    e("div", {className: "desc"},
      cell.state.boxes.map((x, i) =>
        e("div", {
          className: "boxs",
          style: {'backgroundColor': `${x}`},
          onClick: evt => _remove(evt, i)
        })
      )
    )
  )
}
// services definitions
// login
const loginService = {
  // call the service when the view changes
  onchange: state => state.view,
  run: cell => {
    if (cell.state.view === "login") {
      cell.disp(['initForm']);
    } else {
      cell.disp(['cleanupForm']);
    }
  }
};
// play
const playService = {
  onchange: state => state.view,
  run: cell => {
    if (cell.state.view === "play") {
      // load play from localStorage async
      cell.disp(['loadPlay'])
    }
  }
}

// application object
const app = {
  initial: {
    boxes: [],
    colors: ["red", "purple", "blue"],
    description: '',
    stat: [],
    formInitial: {},
    view: 'home'
  },
  services: [loginService, playService],
  views: {
    home: HomeView,
    login: LoginView,
    play: PlayView
  }
};

// update states stream functions
const update = m.stream();

// fold states func
const fold = (state, patcher) => patcher(state);

// states stream folded by fold
const states = m.stream.scan(fold, app.initial, update);

// event dispatcher stream
const disp = m.stream();

const createCell = state => ({ state, disp });

// cells stream as states map
const cells = states.map(createCell);

// cells with dropRepeats if used
//const cells = dropRepeats(states).map(createCell);

/* service must be difined as
const service = {
  onchange: state => state.someProperty,
  run: cell => {
    // ...
    cell.disp(...);
  }
}
*/

// returns actions object
const Actions = (state, update) => {
  // form state will be stored in separated stream
  // initial stream changes to formState stream
  const formId = m.stream('');
  // form changes events
  const formChanges = m.stream({});

  // callback for form's states update
  const updateForm = (form, changed) => {
    // event target anf value
    const target = changed().target;
    let value = target.value;
    return Object.assign(form(), { [target.name]: value });
  };
  //--------------------------------------
  // streams combine as to stream by definition
  // in this stream we store all form object as whole
  // and update it after changes go in formId (initially)
  // or after some form tag value changed with formChanges streams
  const formState = m.stream.combine((fid, newvalue, changed) => {
    if (changed.length > 1)
      return {}; // stream initialization

    // here has chaged formId i.e first of [formId, formChanges] so changed[0]
    // and then we fill formState with state.formInitial
    // which filled sync with formId in dispatcher i.e
    // -- formId('id') && state.formInitial(getItem(from list)) if any --
    // so we need state.formInitial for initial fill formState only
    let c = changed[0]();
    if (typeof c === 'string' || typeof c === 'number')
      // id is a string (number) mapped to item from list if applied
      return state().formInitial;

    // changed some value on blur
    // in form after blur/change changeValue stream changed
    // because onchange: onblur: changeValue declaration
    // (stream is function and value stored in stream)
    return updateForm(formState, newvalue);
  }, [formId, formChanges]);

  const stup = lift(update);
  return {

    // prevent default on event
    prevent(d) {
      let [e] = d;
      e.preventDefault();
      return false;
    },

    // set view to home
    home(d) {
      stup({ view: 'home'});
      return this.prevent(d);
    },

    // set view to login
    login(d) {
      stup({ view: 'login'});
      return this.prevent(d);
    },

    // init login form
    initForm() {
      formId('');
      stup({formInitial: {}, form: formState});
      return false;
    },

    // change form event
    changeForm(d) {
      let [e] = d;
      formChanges(e);
      return this.prevent(d);
    },

    // clean up form if view changed
    cleanupForm() {
      let form = state().form || undefined;
      if (form) {
        let username = form().username || undefined;
        stup({form: undefined, username});
      }
      return false;
    },

    // set view to play
    play(d) {
      stup({view: 'play'})
      return this.prevent(d)
    },

    // load stored boxes from localStore
    loadPlay() {
      let user = state().username, self = this;
      if (user) {
        setTimeout(
          () => self.countStat(
            JSON.parse(
              localStorage.getItem(user) || "[]"
            )
          ),
          500
        )
      }
    },

    // store boxes to localStore return self.home
    logout(d) {
      return this.savePlay(d);
    },

    savePlay(d) {
      let user = state().username, boxes= state().boxes; self = this;
      if(user) {
        setTimeout(
          () => {
            localStorage.setItem(user, JSON.stringify( boxes ));
            self.countStat([]);
            return self.home(d)
          },
          500
        )
      }
    },

    addBox(color) {
      return this.countStat(
        state().boxes.concat(color[0])
      );
    },

    removeBox(idx) {
      return this.countStat(
        state().boxes.filter((x, j) => idx[0] != j)
      );
    },

    countStat(boxes) {
      console.log(boxes);
      let stat = R.countBy(I, boxes), description = descString(stat);
      stup({boxes, stat, description});
      return false;
    }
  };
};

// init apps services
app.services.forEach((service) => {
  dropRepeats(states, service.onchange).map(state =>
    service.run(createCell(state))
  );
});

// init application func
const initApp = (actions) => {
  // init event dispatcher
  disp.map(av => {
    let [event, ...args] = av;
    return actions[event] ? actions[event](args) : m.stream.SKIP;
  });
};
initApp(Actions(states, update));

// main view container
const AppView = function(props) {
  return app.views[props.cell.state.view](props);
}

// react render
const domContainer = document.getElementById('app');
const root = ReactDOM.createRoot(domContainer);
cells.map(cell => root.render( e(AppView, {cell} )));

//meiosisTracer({ selector: "#tracer", streams: [ states, update ] });