const responseFunction = (res, status, message, data, ok) => {
    res.status(status).json({
        message,
        data,
        ok
    })
}

module.exports = responseFunction;