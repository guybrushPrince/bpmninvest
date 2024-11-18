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
    setNodes(nodes) {
        this.#nodes = nodes;
    }
    setEdges(edges) {
        this.#edges = edges;
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
            node.setPreset({});
            node.setPostset({});
        });
    }

    computeInOut() {
        this.resetInOut();
        Object.values(this.#edges).forEach(function (edge) {
            edge.getSource.addOutgoing(edge);
            edge.getTarget.addIncoming(edge);
            edge.getSource.addPostset(edge.getTarget);
            edge.getTarget.addPreset(edge.getSource);
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
class LoopProcess extends Process {}

class Node extends UIModel {
    #type;
    #incoming = {};
    #outgoing = {};
    #preset = {};
    #postset = {};
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

    get getPreset() { return this.#preset; }
    get getPostset() { return this.#postset; }

    setPreset(preset) { this.#preset = preset; }
    setPostset(postset) { this.#postset = postset; }

    addPreset(i) { this.#preset[i.getId] = i; }
    addPostset(o) { this.#postset[o.getId] = o; }

    get copy() {
        return new Node(this.getId, this.getType);
    }

    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=box,label="Activity"];';
    }
}

class Task extends Node {
    get copy() {
        return new Task(this.getId, this.getType);
    }
}
class VirtualTask extends Node {
    constructor(id) {
        super(id, 'VirtualTask');
    }
    get copy() {
        return new VirtualTask(this.getId);
    }

    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=egg,label="Virtual"];';
    }
}

class LoopTask extends Task {
    #loop;
    constructor(id, loop) {
        super(id, 'LoopNode');
        this.#loop = loop;
    }
    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=box3d,label="' + this.#loop.getId + '"];';
    }
}

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

    get copy() {
        return new Gateway(this.getId, this.getType, this.#kind);
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

    get copy() {
        let start = new Start(this.getId, this.getType);
        start.#event = this.#event;
        return start;
    }

    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=circle,label="Start"];';
    }
}
class End extends Node {

    get copy() {
        return new End(this.getId, this.getType);
    }

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

class Loop extends UIModel {
    #nodes = {};
    #entries = {};
    #exits = {};
    #doBody = null;
    #process = null;
    constructor(id, process) {
        super(id);
        this.#process = process;
    }

    get getNodes() {
        return this.#nodes;
    }
    get getEntries() {
        return this.#entries;
    }
    get getExits() {
        return this.#exits;
    }

    addNode(node) {
        this.#nodes[node.getId] = node;
    }
    addEntry(node) {
        this.#entries[node.getId] = node;
    }
    addEntries(entries) {
        this.#entries = union(this.#entries, entries);
    }
    addExit(node) {
        this.#entries[node.getId] = node;
    }
    addExits(exits) {
        this.#exits = union(this.#exits, exits);
    }
    setProcess(process) {
        this.#process = process;
    }

    get getDoBody() {
        if (this.#doBody !== null) return this.#doBody;
        this.#process.computeInOut();

        let workingList = Object.assign({}, this.#entries);
        let doBody = Object.assign({}, workingList);
        let cut = {};
        Object.values(this.#exits).forEach(function(e) {
            cut = union(cut, e.getPostset);
        });
        let it = 0;
        while (Object.values(workingList).length !== 0) {
            let curId = Object.keys(workingList)[0];
            let cur = workingList[curId];
            delete workingList[curId];
            let next = intersect(diff(cur.getPostset, union(cut, doBody)), this.#nodes);
            doBody = union(doBody, next);
            workingList = union(workingList, next);
            it++;
            if (it > 100) break;
        }
        this.#doBody = doBody;

        // By
        //
        // Prinz, T. M., Choi, Y. & Ha, N. L. (2024).
        // Soundness unknotted: An efficient soundness checking algorithm for arbitrary cyclic process models by loosening loops.
        // DOI: https://doi.org/10.1016/j.is.2024.102476
        //
        // a so-called "back join" cannot be an AND
        Object.values(doBody).forEach(node => {
            if (node instanceof Gateway) {
                if (!(node.getId in this.getEntries)) {
                    let isBackJoin = Object.values(node.getPreset).filter(p => !(p.getId in doBody)).length >= 1;
                    if (isBackJoin && node.getKind === GatewayType.AND) {
                        faultBus.addError(
                            this.#process,
                            { backJoin: node, loop: this },
                            FaultType.LOOP_BACK_JOIN_IS_AND
                        );
                    }
                }
            }
        });

        return doBody;
    }
}