import $ from 'jquery';
import { FaultType, faultBus } from "./faultbus.mjs";
import {asList, asObject, diff, intersect, union} from "./settools.mjs";
import { SCC } from "./scc.mjs";
import {flatten} from "array-flatten";

class UIModel {
    #id;
    #ui;
    #elementIds = {};
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
    get getUI$() {
        let ui = this.#ui;
        return $(ui).uniqueSort();
    }
    setUI(ui) {
        this.#ui = ui;
    }
    addElementId(id) {
        if (typeof id === 'string') {
            this.#elementIds[id] = id;
            return;
        }
        if (Array.isArray(id)) {
            id = asObject(flatten(id.map(i => asList(i))));
        }
        this.#elementIds = union(this.#elementIds, id);
    }
    get elementIds() {
        return this.#elementIds;
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
        c += asList(this.#processes).map((p) => p.asDot()).join("\n");
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
    #super = null;

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
        asList(this.#edges).forEach(function(edge) {
            if (edge.getSource.getId === node.getId) edge.setSource(nNode);
            if (edge.getTarget.getId === node.getId) edge.setTarget(nNode);
        });
        if (reset) this.resetInOut();
    }

    get getStarts() {
        if (this.#starts === null) {
            this.#starts = asList(this.#nodes).filter((n) => (n instanceof Start));
        }
        return this.#starts;
    }
    get getEnds() {
        if (this.#ends === null) {
            this.#ends = asList(this.#nodes).filter((n) => (n instanceof End));
        }
        return this.#ends;
    }
    get getLoops() {
        if (this.#loops === null) this.#loops = SCC().analyze(this);
        return this.#loops;
    }

    setLoops(loops) {
        this.#loops = loops;
    }

    setSuper(process) {
        this.#super = process;
    }
    get getSuper() { return this.#super; }


    resetInOut() {
        asList(this.#nodes).forEach(function (node) {
            node.setIncoming({});
            node.setOutgoing({});
            node.setPreset({});
            node.setPostset({});
        });
    }

    computeInOut() {
        this.resetInOut();
        asList(this.#edges).forEach(function (edge) {
            edge.getSource.addOutgoing(edge);
            edge.getTarget.addIncoming(edge);
            edge.getSource.addPostset(edge.getTarget);
            edge.getTarget.addPreset(edge.getSource);
        });
    }

    asDot() {
        let c = 'subgraph cluster_' + this.getId.replaceAll('-', '_') + ' {';
        c += asList(this.#nodes).map((n) => n.asDot()).join("\n");
        c += asList(this.#edges).map((e) => e.asDot()).join("\n");
        c += '}';
        return c;
    }

    isValid() {
        let nodes = this.getNodes;
        asList(this.getEdges).forEach(e => {
            if (!(e.getSource.getId in nodes)) console.log([e.getSource, 'missing', e, this, nodes]);
            if (!(e.getTarget.getId in nodes)) console.log([e.getTarget, 'missing', e, this, nodes]);
        });
    }
}
class LoopProcess extends Process {}

class Node extends UIModel {
    #type;
    #incoming = {};
    #outgoing = {};
    #preset = {};
    #postset = {};
    #repaired = false;
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

    get isRepaired() { return this.#repaired; }
    setRepaired(repaired) { this.#repaired = repaired; }

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
    get getLoop() {
        return this.#loop;
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
    #divergingEnd = false;
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
    setKind(kind) {
        this.#kind = kind;
    }

    setDivergingEnd(divEnd) { this.#divergingEnd = divEnd; }
    get isDivergingEnd() { return this.#divergingEnd; }

    get copy() {
        return new Gateway(this.getId, this.getType, this.#kind);
    }

    asDot() {
        return 'node' + this.getId.replaceAll('-', '_') + '[shape=diamond,label="' + this.#kind + '"];';
    }
}
class LoopEntryGateway extends Gateway {
    #entries;
    constructor(id, entries) {
        super(id, 'LoopEntryGateway', GatewayType.XOR);
        this.#entries = entries;
    }
    get getEntries() { return this.#entries; }
}

class LoopExitGateway extends Gateway {
    #exits;
    constructor(id, exits) {
        super(id, 'LoopExitGateway', GatewayType.XOR);
        this.#exits = exits;
    }
    get getExits() { return this.#exits; }
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
    #edges = null;
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
    get getEdges() {
        if (this.#process !== null) {
            if (this.#edges === null) {
                this.#edges = asList(this.#process.getEdges).reduce((all, edge) => {
                    if (edge.getSource.getId in this.#nodes &&
                        edge.getTarget.getId in this.#nodes) {
                        all[edge.getId] = edge;
                    }
                    return all;
                }, {});
                let ui = this.getUI;
                if (!Array.isArray(ui)) ui = ui.toArray();
                this.setUI([...new Set(ui.concat(asList(this.#edges).map(e => e.getUI)))]);
            }
            return this.#edges;
        }
        return null;
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
    get getProcess() { return this.#process; }

    get getDoBody() {
        if (this.#doBody !== null) return this.#doBody;
        this.#process.computeInOut();

        let workingList = Object.assign({}, this.#entries);
        let doBody = Object.assign({}, workingList);
        let cut = {};
        asList(this.#exits).forEach(function(e) {
            cut = union(cut, e.getPostset);
        });
        let it = 0;
        while (asList(workingList).length !== 0) {
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
        asList(doBody).forEach(node => {
            if (node instanceof Gateway) {
                if (!(node.getId in this.getEntries)) {
                    let notInDoBody = asList(node.getPreset).filter(p => !(p.getId in doBody));
                    let isBackJoin = notInDoBody.length >= 1;
                    if (isBackJoin && node.getKind === GatewayType.AND) {
                        faultBus.addError(
                            this.#process,
                            {
                                backJoin: node,
                                loop: this,
                                paths: blowUpWithEdges(blowUpWithLoopNodes(doBody)),
                                flaws: asObject(notInDoBody)
                            },
                            FaultType.LOOP_BACK_JOIN_IS_AND
                        );
                    }
                }
            }
        });

        return doBody;
    }
}

let blowUpWithLoopNodes = function (elements) {
    let handled = {};
    let previous = 0;
    do {
        previous = handled.length;
        asList(elements).forEach(n => {
            if (n instanceof LoopTask && !(n.getId in handled)) {
                elements = union(elements, n.getLoop.getNodes);
                elements = union(elements, n.getLoop.getEdges);
                handled[n.getId] = n;
            }
        });
    } while (previous < handled.length);
    return elements;
};

let blowUpWithEdges = function (elements) {
    return union(elements, asObject(flatten(asList(elements).map(p => {
        if (p instanceof Node) {
            return asList(union(p.getIncoming, p.getOutgoing)).filter(e => {
                return e.getTarget.getId in elements;
            });
        } else return [];
    }))));
};

export { BPMNModel, Process, Node, Edge, Start, End, Gateway, GatewayType, Task, Loop, LoopEntryGateway, LoopTask,
    LoopExitGateway, VirtualTask, EventType, MessageFlow, LoopProcess, blowUpWithLoopNodes, blowUpWithEdges }