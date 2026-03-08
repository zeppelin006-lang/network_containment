const SVG_NS = "http://www.w3.org/2000/svg";

const ACTIONS = [
  {
    id: "protect",
    label: "保護",
    cost: 1,
    target: "node",
    description: "正常ノードを2ターン保護して感染を防ぐ",
  },
  {
    id: "treat",
    label: "治療",
    cost: 2,
    target: "node",
    description: "感染ノードを正常に戻す",
  },
  {
    id: "cut",
    label: "接続カット",
    cost: 1,
    target: "edge",
    description: "1本の接続を永久に切る",
  },
];

const INITIAL_STAGE = createStage();

const state = {
  stage: null,
  turn: 1,
  maxTurns: 8,
  budgetPerTurn: 2,
  budget: 2,
  selectedAction: "protect",
  status: "playing",
  log: [],
};

const elements = {
  svg: document.querySelector("#network-svg"),
  turn: document.querySelector("#turn-value"),
  budget: document.querySelector("#budget-value"),
  infected: document.querySelector("#infected-value"),
  critical: document.querySelector("#critical-value"),
  actionList: document.querySelector("#action-list"),
  selectionHint: document.querySelector("#selection-hint"),
  logList: document.querySelector("#log-list"),
  restartButton: document.querySelector("#restart-button"),
  endTurnButton: document.querySelector("#end-turn-button"),
  resultCard: document.querySelector("#result-card"),
  resultTitle: document.querySelector("#result-title"),
  resultSummary: document.querySelector("#result-summary"),
  scoreValue: document.querySelector("#score-value"),
};

bootstrap();

function bootstrap() {
  renderActions();
  bindEvents();
  resetGame();
}

function createStage() {
  const nodes = [
    node("A", 90, 90),
    node("B", 250, 80),
    node("C", 430, 90),
    node("D", 610, 80),
    node("E", 820, 100),
    node("F", 140, 220),
    node("G", 300, 220),
    node("H", 480, 220),
    node("I", 660, 220),
    node("J", 840, 230),
    node("K", 100, 370),
    node("L", 260, 370),
    node("M", 440, 360),
    node("N", 620, 370),
    node("O", 800, 370),
    node("P", 170, 520),
    node("Q", 360, 510),
    node("R", 540, 520),
    node("S", 720, 510),
    node("T", 880, 520),
  ];

  const edges = [
    edge("A", "B"),
    edge("A", "F"),
    edge("A", "G"),
    edge("B", "C"),
    edge("B", "F"),
    edge("B", "G"),
    edge("B", "H"),
    edge("C", "D"),
    edge("C", "G"),
    edge("C", "H"),
    edge("C", "I"),
    edge("D", "E"),
    edge("D", "H"),
    edge("D", "I"),
    edge("E", "I"),
    edge("E", "J"),
    edge("F", "G"),
    edge("F", "K"),
    edge("F", "L"),
    edge("G", "H"),
    edge("G", "L"),
    edge("G", "M"),
    edge("H", "I"),
    edge("H", "M"),
    edge("H", "N"),
    edge("I", "J"),
    edge("I", "N"),
    edge("I", "O"),
    edge("J", "O"),
    edge("K", "L"),
    edge("K", "P"),
    edge("G", "K"),
    edge("L", "M"),
    edge("L", "P"),
    edge("L", "Q"),
    edge("M", "N"),
    edge("M", "Q"),
    edge("M", "R"),
    edge("N", "O"),
    edge("N", "R"),
    edge("N", "S"),
    edge("O", "S"),
    edge("O", "T"),
    edge("P", "Q"),
    edge("Q", "R"),
    edge("R", "S"),
    edge("S", "T"),
  ];

  infect(nodes, "A");
  infect(nodes, "T");

  return { nodes, edges };
}

function node(id, x, y, critical = false) {
  return {
    id,
    x,
    y,
    critical,
    infected: false,
    protectedTurns: 0,
  };
}

function edge(a, b) {
  return {
    id: `${a}-${b}`,
    a,
    b,
    cut: false,
  };
}

function infect(nodes, id) {
  const target = nodes.find((item) => item.id === id);
  if (target) {
    target.infected = true;
  }
}

function cloneStage(stage) {
  return {
    nodes: stage.nodes.map((item) => ({ ...item })),
    edges: stage.edges.map((item) => ({ ...item })),
  };
}

function chooseCriticalNodes(stage, count = 4) {
  const candidates = stage.nodes.filter((item) => !item.infected);
  const shuffled = [...candidates];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const pickedIds = new Set(shuffled.slice(0, count).map((item) => item.id));
  for (const currentNode of stage.nodes) {
    currentNode.critical = pickedIds.has(currentNode.id);
  }
}

function bindEvents() {
  elements.restartButton.addEventListener("click", resetGame);
  elements.endTurnButton.addEventListener("click", advanceTurn);
}

function resetGame() {
  state.stage = cloneStage(INITIAL_STAGE);
  chooseCriticalNodes(state.stage);
  state.turn = 1;
  state.budget = state.budgetPerTurn;
  state.selectedAction = "protect";
  state.status = "playing";
  state.log = [
    "重要ノードはリスタートごとにランダムで入れ替わります。毎回、急所を読み直してください。",
    "感染源は A と T。8ターンのあいだランダムに選ばれた重要ノードを守り切ってください。",
  ];
  hideResult();
  render();
}

function renderActions() {
  elements.actionList.innerHTML = "";
  for (const action of ACTIONS) {
    const button = document.createElement("button");
    button.className = "action-button";
    button.type = "button";
    button.dataset.actionId = action.id;
    button.textContent = `${action.label} (${action.cost})`;
    button.title = action.description;
    button.addEventListener("click", () => {
      if (state.status !== "playing") {
        return;
      }
      state.selectedAction = action.id;
      render();
    });
    elements.actionList.appendChild(button);
  }
}

function render() {
  renderStats();
  renderActionsState();
  renderGraph();
  renderLog();
}

function renderStats() {
  const infectedCount = getInfectedCount();
  const infectedCritical = getCriticalInfectedCount();
  elements.turn.textContent = `${state.turn} / ${state.maxTurns}`;
  elements.budget.textContent = `${state.budget}`;
  elements.infected.textContent = `${infectedCount}`;
  elements.critical.textContent = `${infectedCritical} / ${getCriticalCount()}`;
  elements.selectionHint.textContent = getHintText();
  elements.endTurnButton.disabled = state.status !== "playing";
}

function renderActionsState() {
  const buttons = elements.actionList.querySelectorAll(".action-button");
  for (const button of buttons) {
    button.classList.toggle("active", button.dataset.actionId === state.selectedAction);
    button.disabled = state.status !== "playing";
  }
}

function renderGraph() {
  elements.svg.innerHTML = "";

  for (const currentEdge of state.stage.edges) {
    const from = getNode(currentEdge.a);
    const to = getNode(currentEdge.b);

    const line = createSvg("line", {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      class: `edge ${currentEdge.cut ? "cut" : ""}`,
    });
    elements.svg.appendChild(line);

    const hit = createSvg("line", {
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      class: "edge-hit",
      "data-edge-id": currentEdge.id,
    });
    hit.addEventListener("click", () => applyActionToEdge(currentEdge.id));
    elements.svg.appendChild(hit);
  }

  for (const currentNode of state.stage.nodes) {
    const group = createSvg("g", {
      class: `node ${currentNode.infected ? "turn-flash" : ""}`,
      transform: `translate(${currentNode.x}, ${currentNode.y})`,
      "data-node-id": currentNode.id,
    });
    group.addEventListener("click", () => applyActionToNode(currentNode.id));

    const ring = createSvg("circle", {
      class: "node-ring",
      r: currentNode.critical ? 26 : 0,
      stroke: currentNode.critical ? "rgba(215, 166, 50, 0.9)" : "transparent",
    });
    group.appendChild(ring);

    const core = createSvg("circle", {
      class: "node-core",
      r: 20,
      fill: nodeFill(currentNode),
    });
    group.appendChild(core);

    if (currentNode.protectedTurns > 0) {
      const shield = createSvg("circle", {
        class: "node-ring",
        r: 31,
        stroke: "rgba(42, 125, 209, 0.85)",
      });
      group.appendChild(shield);
    }

    const label = createSvg("text", {
      class: "node-label",
      x: 0,
      y: 1,
    });
    label.textContent = currentNode.id;
    group.appendChild(label);

    elements.svg.appendChild(group);
  }
}

function nodeFill(currentNode) {
  if (currentNode.infected) {
    return "#cf4c39";
  }
  if (currentNode.protectedTurns > 0) {
    return "#2a7dd1";
  }
  if (currentNode.critical) {
    return "#b99537";
  }
  return "#d3cabb";
}

function renderLog() {
  elements.logList.innerHTML = "";
  for (const line of state.log.slice(0, 6)) {
    const item = document.createElement("li");
    item.textContent = line;
    elements.logList.appendChild(item);
  }
}

function getHintText() {
  const action = ACTIONS.find((item) => item.id === state.selectedAction);
  if (state.status !== "playing") {
    return "リスタートして別の介入順を試せます。";
  }
  return `${action.label}: ${action.description}`;
}

function applyActionToNode(nodeId) {
  if (state.status !== "playing") {
    return;
  }

  const action = getSelectedAction();
  if (action.target !== "node") {
    pushLog("このアクションは線をクリックして使います。");
    render();
    return;
  }
  if (state.budget < action.cost) {
    pushLog("予算が足りません。ターンを進めてください。");
    render();
    return;
  }

  const currentNode = getNode(nodeId);
  if (action.id === "protect") {
    if (currentNode.infected) {
      pushLog(`${nodeId} はすでに感染しています。治療が必要です。`);
      render();
      return;
    }
    if (currentNode.protectedTurns > 0) {
      pushLog(`${nodeId} はすでに保護中です。`);
      render();
      return;
    }
    currentNode.protectedTurns = 2;
    spendBudget(action.cost);
    pushLog(`${nodeId} を2ターン保護しました。`);
  }

  if (action.id === "treat") {
    if (!currentNode.infected) {
      pushLog(`${nodeId} は感染していません。`);
      render();
      return;
    }
    currentNode.infected = false;
    currentNode.protectedTurns = 1;
    spendBudget(action.cost);
    pushLog(`${nodeId} を治療し、1ターンだけ再感染を防ぎます。`);
  }

  render();
}

function applyActionToEdge(edgeId) {
  if (state.status !== "playing") {
    return;
  }

  const action = getSelectedAction();
  if (action.target !== "edge") {
    pushLog("このアクションはノードをクリックして使います。");
    render();
    return;
  }
  if (state.budget < action.cost) {
    pushLog("予算が足りません。ターンを進めてください。");
    render();
    return;
  }

  const currentEdge = getEdge(edgeId);
  if (currentEdge.cut) {
    pushLog(`${edgeId} はすでに切断済みです。`);
    render();
    return;
  }

  currentEdge.cut = true;
  spendBudget(action.cost);
  pushLog(`${currentEdge.a} - ${currentEdge.b} の接続を切りました。`);
  render();
}

function advanceTurn() {
  if (state.status !== "playing") {
    return;
  }

  const newInfections = [];
  for (const currentEdge of state.stage.edges) {
    if (currentEdge.cut) {
      continue;
    }

    const left = getNode(currentEdge.a);
    const right = getNode(currentEdge.b);

    spreadAttempt(left, right, newInfections);
    spreadAttempt(right, left, newInfections);
  }

  for (const nodeId of newInfections) {
    const currentNode = getNode(nodeId);
    currentNode.infected = true;
    currentNode.protectedTurns = 0;
  }

  for (const currentNode of state.stage.nodes) {
    if (currentNode.protectedTurns > 0) {
      currentNode.protectedTurns -= 1;
    }
  }

  if (newInfections.length > 0) {
    pushLog(`感染拡大: ${newInfections.join(", ")}`);
  } else {
    pushLog("このターンは新規感染が発生しませんでした。");
  }

  if (getCriticalInfectedCount() >= 2) {
    finishGame(false, "重要ノードが2つ以上感染し、封じ込めに失敗しました。");
    return;
  }

  if (state.turn >= state.maxTurns) {
    finishGame(true, "8ターン持ちこたえ、重要ノードの大半を守りました。");
    return;
  }

  state.turn += 1;
  state.budget = state.budgetPerTurn;
  render();
}

function spreadAttempt(source, target, collector) {
  if (
    !source.infected ||
    target.infected ||
    target.protectedTurns > 0
  ) {
    return;
  }

  const chance = source.critical || target.critical ? 0.78 : 0.62;
  if (Math.random() < chance && !collector.includes(target.id)) {
    collector.push(target.id);
  }
}

function finishGame(won, summary) {
  state.status = won ? "won" : "lost";
  const score = Math.max(
    0,
    100 - getInfectedCount() * 8 - getCriticalInfectedCount() * 15 + state.turn * 3,
  );
  elements.resultCard.classList.remove("hidden", "win", "lose");
  elements.resultCard.classList.add(won ? "win" : "lose");
  elements.resultTitle.textContent = won ? "勝利" : "敗北";
  elements.resultSummary.textContent = summary;
  elements.scoreValue.textContent = `スコア: ${score}`;
  render();
}

function hideResult() {
  elements.resultCard.classList.add("hidden");
  elements.resultCard.classList.remove("win", "lose");
}

function spendBudget(cost) {
  state.budget -= cost;
}

function pushLog(message) {
  state.log.unshift(message);
}

function getNode(id) {
  return state.stage.nodes.find((item) => item.id === id);
}

function getEdge(id) {
  return state.stage.edges.find((item) => item.id === id);
}

function getSelectedAction() {
  return ACTIONS.find((item) => item.id === state.selectedAction);
}

function getInfectedCount() {
  return state.stage.nodes.filter((item) => item.infected).length;
}

function getCriticalCount() {
  return state.stage.nodes.filter((item) => item.critical).length;
}

function getCriticalInfectedCount() {
  return state.stage.nodes.filter((item) => item.critical && item.infected).length;
}

function createSvg(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}
