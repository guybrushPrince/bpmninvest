class IdModel {
    #id;
    constructor(id) {
        this.#id = id;
    }
    get getId() {
        return this.#id;
    }
}
class BPMNModel extends IdModel {
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
}

class Process extends IdModel {
    #nodes = {};
    #edges = {};
    #starts = null;
    #ends = null;
    get getNodes() {
        return this.#nodes;
    }
    get getTarget() {
        return this.#edges;
    }
    addNode(node) {
        this.#nodes[node.getId] = node;
    }
    addEdge(edge) {
        this.#edges[edge.getId] = edge;
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

    computeInOut() {
        for (const node of Object.values(this.#nodes)) {
            node.setIncoming({});
            node.setOutgoing({});
        }
        for (const edge of Object.values(this.#edges)) {
            edge.getSource.addOutgoing(edge);
            edge.getTarget.addIncoming(edge);
        }
    }
}

class Node extends IdModel {
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
}

class Task extends Node { }
const GatewayType = {
    AND: 'AND',
    XOR: 'XOR',
    OR: 'OR'
}
class Gateway extends Node {
    #kind;
    constructor(id, type) {
        super(id, type);
        if (type.startsWith('bpmn:Parallel')) this.#kind = GatewayType.AND;
        else if (type.startsWith('bpmn:Exclusive')) this.#kind = GatewayType.XOR;
        else if (type.startsWith('bpmn:Inclusive')) this.#kind = GatewayType.OR;
    }

    get getKind() {
        return this.#kind;
    }
}
class Start extends Node { }
class End extends Node { }

class Edge extends IdModel {
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
}

class MessageFlow extends Edge { }