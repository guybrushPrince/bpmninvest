class UIModel {
    #id;
    #ui;
    constructor(id) {
        this.#id = id;
        this.#ui = $('[data-element-id="' + id + '"]');
    }
    get getId() {
        return this.#id;
    }
    get getUI() {
        return this.#ui;
    }
    setUI(ui) {
        this.#ui = ui;
    }
}
class BPMNModel extends UIModel {
    #processes = {};
    #messages = {};

    get getProcesses() {
        return this.#processes;
    }
    get getMessages() {
        return this.#messages;
    }
    addProcess(process) {
        this.#processes[process.getId] = process;
    }
    setProcesses(processes) {
        this.#processes = processes;
    }
    addMessage(message) {
        this.#messages[message.getId] = message;
    }
    setMessages(messages) {
        this.#messages = messages;
    }

    asDot() {
        let c = 'digraph G {';
        c += Object.values(this.#processes).map((p) => p.asDot()).join("\n");
        c += '}';
        return c;
    }
}

class Process extends UIModel {
    #nodes = {};
    #edges = {};
    #starts = null;
    #ends = null;

    #loops = null;

    get getNodes() {
        return this.#nodes;
    }
    get getEdges() {
        return this.#edges;
    }
    addNode(node) {
        this.#nodes[node.getId] = node;
    }
    addEdge(edge) {
        this.#edges[edge.getId] = edge;
    }

    replaceNode(node, nNode, reset = true) {
        this.#nodes[node.getId] = nNode;
        Object.values(this.#edges).forEach(function(edge) {
            if (edge.getSource.getId === node.getId) edge.setSource(nNode);
            if (edge.getTarget.getId === node.getId) edge.setTarget(nNode);
        });
        if (reset) this.resetInOut();
    }

    get getStarts() {
        if (this.#starts === null) {
            this.#starts = Object.values(this.#nodes).filter((n) => (n instanceof Start));
        }
        return this.#starts;
    }
    get getEnds() {
        if (this.#ends === null) {
            this.#ends = Object.values(this.#nodes).filter((n) => (n instanceof End));
        }
        return this.#starts;
    }
    get getLoops() {
        if (this.#loops === null) this.#loops = SCC().analyze(this);
        return this.#loops;
    }

    setLoops(loops) {
        this.#loops = loops;
    }


    resetInOut() {
        Object.values(this.#nodes).forEach(function (node) {
            node.setIncoming({});
            node.setOutgoing({});
        });
    }

    computeInOut() {
        this.resetInOut();
        Object.values(this.#edges).forEach(function (edge) {
            edge.getSource.addOutgoing(edge);
            edge.getTarget.addIncoming(edge);
        });
    }

    asDot() {
        let c = 'subgraph cluster_' + this.getId.replaceAll('-', '_') + ' {';
        c += Object.values(this.#nodes).map((n) => n.asDot()).join("\n");
        c += Object.values(this.#edges).map((e) => e.asDot()).join("\n");
        c += '}';
        return c;
    }
}

class Node extends UIModel {
    #type;
    #incoming = {};
    #outgoing ={};
    constructor(id, type) {
        super(id);
        this.#type = type;
    }

    get getType() {
        return this.#type;
    }
    get getIncoming() { return this.#incoming; }
    get getOutgoing() { return this.#outgoing; }

    setIncoming(incoming) { this.#incoming = incoming; }
    setOutgoing(outgoing) { this.#outgoing = outgoing; }

    addIncoming(i) { this.#incoming[i.getId] = i; }
    addOutgoing(o) { this.#outgoing[o.getId] = o; }

    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=box,label="Activity"];';
    }
}

class Task extends Node { }
const GatewayType = {
    AND: 'AND',
    XOR: 'XOR',
    OR: 'OR'
}
class Gateway extends Node {
    #kind;
    constructor(id, type, kind = null) {
        super(id, type);
        if (kind === null) {
            if (type.startsWith('bpmn:Parallel')) this.#kind = GatewayType.AND;
            else if (type.startsWith('bpmn:Exclusive')) this.#kind = GatewayType.XOR;
            else if (type.startsWith('bpmn:Inclusive')) this.#kind = GatewayType.OR;
        } else this.#kind = kind;
    }

    get getKind() {
        return this.#kind;
    }

    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=diamond,label="' + this.#kind + '"];';
    }
}
const EventType = {
    MESSAGE: 'MESSAGE',
    SIGNAL: 'SIGNAL',
    CONDITIONAL: 'CONDITIONAL',
    TIMER: 'TIMER'
};
class Start extends Node {
    #event = null;

    setEvent(event) {
        this.#event = event;
    }
    get getEvent() {
        return this.#event;
    }

    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=circle,label="Start"];';
    }
}
class End extends Node {

    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=doublecircle,label="End"];';
    }
}

class Edge extends UIModel {
    #source;
    #target;
    constructor(id, source, target) {
        super(id);
        this.#source = source;
        this.#target = target;
    }

    get getSource() {
        return this.#source;
    }
    get getTarget() {
        return this.#target;
    }
    setSource(source) {
        this.#source = source;
    }
    setTarget(target) {
        this.#target = target;
    }

    asDot() {
        return 'node' + this.#source.getId.replaceAll('-', '_') + ' -> ' + 'node' + this.#target.getId.replaceAll('-', '_') + ';';
    }
}

class MessageFlow extends Edge { }