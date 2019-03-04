class Response {
    constructor() {}

    setMessage(message) {
        this.message = message;
    }

    setStatusCode(statusCode) {
        this.statusCode = statusCode;
    }

    setActionType(actionType) {
        this.actionType = actionType;
    }

    setData(data) {
        this.data = data;
    }
}

export default Response;