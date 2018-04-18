(function () {

  const isEq = (x) => x === '='
  const isSign = (x) => x === 'sign'
  const isClean = (x) => x === 'clean'
  const isOperation = (x) => '+-/*'.indexOf(x) >= 0
  const isPercentage = (x) => x === '%'
  const isDigit = (x) => '0123456789'.indexOf(x) >= 0
  const isNumber = (x) => !Number.isNaN(Number.parseFloat(x))
  const isZero = (x) => x === '0'
  const isDelimiter = (x) => x === ','
  const isFloat = (x) => x.indexOf('.') >= 0
  const isNegativeNumber = (x) => x[0] === '-'
  const operationCount = (x) => x.reduce((acc, cur) => isOperation(cur) ? acc + 1 : acc, 0)

  const Priority = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2
  }

  const Operations = {
    '+': (arg1, arg2) => Number.parseFloat(arg1) + Number.parseFloat(arg2),
    '-': (arg1, arg2) => Number.parseFloat(arg1) - Number.parseFloat(arg2),
    '*': (arg1, arg2) => Number.parseFloat(arg1) * Number.parseFloat(arg2),
    '/': (arg1, arg2) => Number.parseFloat(arg1) / Number.parseFloat(arg2)
  }

  function takeLastNumber(tokens) {
    const index = R.findLastIndex(isNumber, tokens)

    if (index >= 0) {
      return {
        value: tokens[index],
        position: index
      }
    }

    return { value: '0', position: 0 }
  }

  function takeLastOperation(tokens) {
    const index = R.findLastIndex(isOperation, tokens)

    if (index >= 0) {
      return {
        value: tokens[index],
        arg1: tokens[index - 1],
        arg2: tokens[index + 1],
        position: index
      }
    }

    return null
  }

  function takeOperationAt(index, tokens) {
    return {
      value: tokens[index],
      arg1: tokens[index - 1],
      arg2: tokens[index + 1]
    }
  }

  function performOperation(index, tokens) {
    const { value, arg1, arg2 } = takeOperationAt(index, tokens)

    return R.pipe(
      R.remove(index - 1, 3),
      R.insert(index - 1, Operations[value](arg1, arg2).toString())
      )(tokens)
  }

  function performAllOperations(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      if (isOperation(tokens[i]) && Priority[tokens[i]] > 1) {
        tokens = performOperation(i, tokens)
      }
    }

    for (let i = 0; i < tokens.length; i++) {
      if (isOperation(tokens[i])) {
        tokens = performOperation(i, tokens)
        i--;
      }
    }

    return tokens
  }

  function handleEq(state) {
    const { tokens, lastOp, lastArg } = state

    if (tokens.length === 1 && lastOp && lastArg) {
      return handleEq(
        R.assoc('tokens', R.concat(tokens, [lastOp, lastArg]), state)
        )
    }

    if (tokens.length === 1) {
      return state
    }

    const lastToken = R.last(tokens)

    if (isOperation(lastToken)) {
      const lastNumber = takeLastNumber(tokens)

      return handleEq(R.assoc('tokens', R.append(lastNumber.value, tokens), state))
    }

    return R.merge(state, {
      tokens: performAllOperations(tokens),
      lastOp: takeLastOperation(tokens).value,
      lastArg: takeLastNumber(tokens).value
    })
  }

  function handleSign(state) {
    const { value, position } = takeLastNumber(state.tokens)

    if (value === '0') {
      return state
    }

    return R.assoc(
      'tokens',
      R.update(
        position,
        isNegativeNumber(value) ? R.tail(value) : `-${value}`,
        state.tokens
        ),
      state
      )
  }

  function handleClean(state) {
    return {
      tokens: ['0'],
      lastArg: null,
      lastOp: null
    }
  }

  function handleOperation(state, op) {
    const lastToken = R.last(state.tokens)

    if (isOperation(lastToken)) {
      return R.assoc('tokens',
        R.update(lastToken.position, op, state.tokens), state)
    }

    if (operationCount(state.tokens) >= 1) {
      const { value, arg1, arg2, position } = takeLastOperation(state.tokens)

      if (Priority[value] >= Priority[op]) {
        return handleOperation(
          R.assoc('tokens', performOperation(position, state.tokens), state),
          op
          )
      }
    }

    return R.assoc('tokens', R.append(op, state.tokens), state)
  }

  function handlePercentage(state) {
    const { value, position } = takeLastNumber(state.tokens)

    return R.assoc('tokens',
      R.update(position, Number.parseFloat(value) / 100, state.tokens), state)
  }

  function handleDigit(state, digit) {
    const lastToken = R.last(state.tokens)

    if (isZero(lastToken)) {
      return R.assoc('tokens',
        R.update(state.tokens.length - 1, digit, state.tokens), state)
    }

    if (isNumber(lastToken)) {
      const val = `${lastToken}${digit}`
      return R.assoc('tokens',
        R.update(state.tokens.length - 1, val, state.tokens), state)
    }

    return R.assoc('tokens', R.append(digit, state.tokens), state)
  }

  function handleDelimiter(state) {
    const { value, position } = takeLastNumber(state.tokens)

    if (isFloat(value)) {
      return state
    }

    return R.assoc('tokens', R.update(position, `${value}.`, state.tokens), state)
  }

  const Handlers = [
    { cond: isEq, handler: handleEq },
    { cond: isSign, handler: handleSign },
    { cond: isClean, handler: handleClean },
    { cond: isOperation, handler: handleOperation },
    { cond: isPercentage, handler: handlePercentage },
    { cond: isDigit, handler: handleDigit },
    { cond: isDelimiter, handler: handleDelimiter }
  ]

  function performCalc(state, token) {
    for (let i = 0; i < Handlers.length; i++) {
      if (Handlers[i].cond(token)) {
        return Handlers[i].handler(state, token)
      }
    }

    return state
  }

  const $result = document.querySelector('#result')
  const $controls = document.querySelector('#controls')
  const $cleanBtn = document.querySelector('#clean')

  let state = {
    tokens: ['0'],
    lastArg: null,
    lastOp: null
  }

  $controls.addEventListener('click', (ev) => {
    state = performCalc(state, ev.target.dataset.token)

    console.log(state)

    if (state.tokens.length > 1 || !isZero(state.tokens[0])) {
      $cleanBtn.innerText = 'C'
    } else {
      $cleanBtn.innerText = 'AC'
    }

    $result.innerText = takeLastNumber(state.tokens).value
  })

})()
