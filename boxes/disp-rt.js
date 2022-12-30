
// help functions to control streams
const e = React.createElement;

const I = x => x; // identity

// Patcher - func return the patch func of the current state
const P = patch => state => Object.assign(state, patch);

// lift up the update stream
const lift = update => patch => update(P(patch));

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

// empty application object
const app = {
  initial: {
    boxes: [],
    colors: ["red", "purple", "blue"],
    description: '',
    stat: []
  },
};

// update states stream functions
const update = m.stream();

// fold states func
const fold = (state, patcher) => patcher(state);

// states stream folded by fold
const states = m.stream.scan(fold, app.initial, update);

// event dispatcher stream
const disp = m.stream();

const createCell = (state) => ({ state, disp });
const cells = states.map(createCell);

// actions object
const Actions = (state, update) => {
  const stup = lift(update);
  return {
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
      let stat = R.countBy(I, boxes), description = descString(stat);
      stup({boxes, stat, description});
      return false;
    }
  };
};

// init application func
const initApp = (actions) => {
  // init event dispatcher
  disp.map(av => {
    let [event, ...args] = av;
    return actions[event] ? actions[event](args) : m.stream.SKIP;
  });
};
initApp(Actions(states, update));

const add = (evt, color) => {
  evt.preventDefault();
  return disp(['addBox', color])
}
const remove = (evt, idx) => {
  evt.preventDefault();
  return disp(['removeBox', idx])
}

const BoxesView = function(props) {

  const cell = props.cell;
  console.log(cell);

  return e("div", {className: "app"}, [
    e("nav", {className:"header"}, [
      e("h1", null, "Boxes"),
      cell.state.colors.map(color =>
        e("button", {
            style: {'backgroundColor': `${color}`},
            onClick: evt => add(evt, `${color}`)
          }, "+"
        )
      )
    ]),
    e("p", null, cell.state.description),
    e("div", {className: "desc"},
      cell.state.boxes.map((x, i) =>
        e("div", {
          className: "boxs",
          style: {'backgroundColor': `${x}`},
          onClick: evt => remove(evt, i)
        })
      )
    )
  ])
}

const domContainer = document.getElementById('app');
const root = ReactDOM.createRoot(domContainer);
cells.map(cell => root.render( e(BoxesView, {cell} )));

meiosisTracer({ selector: "#tracer", streams: [ states, update ] });