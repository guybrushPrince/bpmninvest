let extractDiagram = function (diagram, index) {
    // The diagram model.
    let m = new BPMNModel(diagram.id);

    let nodes = {};
    let edges = {};

    let getOrCreateNode = function (id, type) {
        if (!(id in nodes)) {
            if (type.includes('Task')) nodes[id] = new Task(id, type);
            else if (type.includes('Start')) nodes[id] = new Start(id, type);
            else if (type.includes('End')) nodes[id] = new End(id, type);
            else if (type.includes('Gateway')) nodes[id] = new Gateway(id, type);
            else console.log([id, type]);
        }
        return nodes[id];
    };
    let getOrCreateDetailedNode = function (node) {
        let n = getOrCreateNode(node.id, node.$type);
        if (n instanceof Start) {
            if ('eventDefinitions' in node && Array.isArray(node.eventDefinitions)) {
                for (let ev of node.eventDefinitions) {
                    if (ev.$type.includes('Timer')) n.setEvent(EventType.TIMER);
                    else if (ev.$type.includes('Conditional')) n.setEvent(EventType.CONDITIONAL);
                    else if (ev.$type.includes('Message')) n.setEvent(EventType.MESSAGE);
                    else if (ev.$type.includes('Signal')) n.setEvent(EventType.SIGNAL);
                }
            }
        }
        return n;
    };
    let getOrCreateEdge = function (flow) {
        let id = flow.id;
        if (!(id in edges)) {
            edges[id] = new Edge(id,
                getOrCreateNode(flow.sourceRef.id, flow.sourceRef.$type),
                getOrCreateNode(flow.targetRef.id, flow.targetRef.$type)
            );
        }
        return edges[id];
    };

    let findElements = function (p, elements) {
        elements.forEach(function (el) {
            let type = el.$type;
            if (type.includes('SequenceFlow')) {
                p.addEdge(getOrCreateEdge(el));
            } else { // It is a node
                p.addNode(getOrCreateDetailedNode(el));
            }
        });
    };

    if ('plane' in diagram) {
        let plane = diagram.plane;
        if ('bpmnElement' in plane) {
            let container = plane.bpmnElement;
            if ('messageFlows' in container && Array.isArray(container.messageFlows)) {
                m.setMessages(container.messageFlows.map(function (flow) {
                    return new MessageFlow(flow.id,
                        getOrCreateNode(flow.sourceRef.id, flow.sourceRef.$type),
                        getOrCreateNode(flow.targetRef.id, flow.targetRef.$type)
                    );
                }));
            }
            if ('participants' in container && Array.isArray(container.participants)) {
                m.setProcesses(container.participants.map(function (process) {
                    let p = new Process(process.id);
                    findElements(p, process.processRef.flowElements);
                    p.computeInOut();
                    return p;
                }));
            }
        } else if ('planeElement' in plane) {

        }
    }
    return m;
};

let analyze = function () {
    let modeler = null;
    if (typeof bpmnio !== 'undefined') {
        if ('modeler' in bpmnio) {
            modeler = bpmnio.modeler;
        }
    } else if (typeof bpmnModeler !== undefined) {
        modeler = bpmnModeler;
    }
    if ('_definitions' in modeler) {
        let definitions = modeler._definitions;
        if ('diagrams' in definitions) {
            let diagrams = definitions.diagrams;
            if (Array.isArray(diagrams)) {
                let exp = diagrams.map(extractDiagram);
                console.log(exp);
                return exp;
            }
        }
    }
    return null;
};