//gmxAPI = {};
/* 
   Single-pass recursive descent PEG parser library:
      http://en.wikipedia.org/wiki/Parsing_expression_grammar
   Inspired by Chris Double's parser combinator library in JavaScript:
      http://www.bluishcoder.co.nz/2007/10/javascript-packrat-parser.html
	+ Добавлены функции: Math.floor, Math.round
*/
(function()
{
	var Parsers = {};						// Парсеры

	var Pair = function(t1, t2)
	{
		var head = t1;
		var tail = t2;
		return { 'head': t1, 'tail': t2};
	}

// C-style linked list via recursive typedef. 
//   Used purely functionally to get shareable sublists.
//typedef LinkedList = Pair<Dynamic, LinkedList>;
	var LinkedList = function(t1, t2)
	{
		return Pair(t1, t2);
	}

// Parser state contains position in string and some accumulated data.
//typedef ParserState = Pair<Int, LinkedList>;
	var ParserState = function(t1, t2)
	{
		return Pair(t1, t2);
	}

// Parser accepts string and state, returns another state.
//typedef Parser = String->ParserState->ParserState;
	
	
	// A parser state that indicates failure.
	var fail = new ParserState(-1, null);

	// Check for failure.
	var failed = function(state)
	{
		return (state.head == -1);
	}

	// Advance a parser state by n characters.
	var advance = function(state, n)
	{
		return new ParserState(state.head + n, state.tail);
	}
	
	// Match a specified string.
	var token = function(tok)
	{
		var len = tok.length;
		return function(s, state)
		{
			return (s.substr(state.head, len) == tok) ? advance(state, len) : fail;
		}
	}

	// Match a string without regard to case.
	var caseInsensitiveToken = function(tok)
	{
		var len = tok.length;
		tok = tok.toLowerCase();
		return function(s, state)
		{
			return (s.substr(state.head, len).toLowerCase() == tok) ? advance(state, len) : fail;
		}
	}

	// Match a single character in a specified range.
	var range = function(startChar, endChar)
	{
		var startCode = startChar.charCodeAt(0);
		var endCode = endChar.charCodeAt(0);
		return function(s, state)
		{
			var code = s.charCodeAt(state.head);
			return ((code >= startCode) && (code <= endCode)) ? advance(state, 1) : fail;
		}
	}

	// Match any character outside a certain set.
	//   This combinator is intended only for single character parsers.
	var anythingExcept = function(parser)
	{
		return function(s, state)
		{
			return ((s.length > state.head) && failed(parser(s, state))) ? advance(state, 1) : fail;
		}
	}

	// Match thing1, then thing2, ..., then thingN.
	var sequence = function(parsers)
	{
		return function(s, state)
		{
			for (var i=0; i < parsers.length; i++)
			{
				state = parsers[i](s, state);
				if (failed(state))
					return fail;
			}
			return state;
		}
	}
	
	// Match thing1, or thing2, ..., or thingN.
	var choice = function(parsers)
	{
		return function(s, state)
		{
			for (var i=0; i < parsers.length; i++)
			{
				var newState = parsers[i](s, state);
				if (!failed(newState))
					return newState;
			}
			return fail;
		}
	}

	// Match immediately, without regard to what's in the string.
	var nothing = function(s, state) 
	{ 
		return state; 
	}

	// Match this thing or nothing.
	var maybe = function(parser)
	{
		return choice([parser, nothing]);
	}
	
	// Match minCount or more repetitions of this thing.
	var repeat = function(minCount, parser)
	{
		return function(s, state)
		{
			var count = 0;
			while (true)
			{
				var newState = parser(s, state);
				if (failed(newState))
					return (count >= minCount) ? state : fail;
				else
				{
					count += 1;
					state = newState;
				}
			}
			return fail;
		}
	}

	// Match a list of minCount or more instances of thing1, separated by thing2.
	var separatedList = function(minCount, parser, separator)
	{
		var parser1 = sequence([parser, repeat(minCount - 1, sequence([separator, parser]))]);
		return (minCount > 0) ? parser1 : choice([parser1, nothing]);
	}
	
	var whitespace = repeat(0, choice([
		token(" "),
		token("\t"),
		token("\n")
	]));

	// Same as separatedList, but can have whitespace between items and separators.
	var whitespaceSeparatedList = function(minCount, parser, separator)
	{
		return separatedList(minCount, parser, sequence([whitespace, separator, whitespace]));
	}

	// Same as sequence, but can have whitespace between items.
	var whitespaceSeparatedSequence = function(parsers)
	{
		var newParsers = new Array();
		for (var i = 0; i < parsers.length; i++)
		{
			if (newParsers.length > 0)
				newParsers.push(whitespace);
			newParsers.push(parsers[i]);
		}
		return sequence(newParsers);
	}

	// This combinator captures the string that the parser matched
	//   and adds it to the current parser state, consing a new state.
	var capture = function(parser)
	{
		return function(s, state)
		{
			var newState = parser(s, state);
			return failed(newState) ? fail : new ParserState(newState.head, new LinkedList(s.substr(state.head, newState.head - state.head), newState.tail));
		}
	}

	// This combinator passes the accumulated parser state to a given 
	//  function for processing. The result goes into the new state.
	var action = function(parser, func)
	{
		return function(s, state)
		{
			var oldState = state;
			var newState = parser(s, new ParserState(oldState.head, null));
			return failed(newState) ? fail : new ParserState(newState.head, new LinkedList(func(newState.tail), oldState.tail));
		}
	}

	// Define a syntactic subset of SQL WHERE clauses.
	var fieldName = capture(repeat(1, choice([
		range("a", "z"),
		range("A", "Z"),
		range("а", "я"),
		range("А", "Я"),
		range("0", "9"),
		token("_")
	])));

	var fieldNameWithSpaces = capture(repeat(1, choice([
		range("a", "z"),
		range("A", "Z"),
		range("а", "я"),
		range("А", "Я"),
		range("0", "9"),
		token("_"),
		token(" ")
	])));

	var quotedFieldName = choice([
		fieldName,
		sequence([token('"'), fieldNameWithSpaces, token('"')]),
		sequence([token('`'), fieldNameWithSpaces, token('`')])
	]);

	var stringLiteral = sequence([
		token("'"),
		capture(repeat(0, anythingExcept(token("'")))),
		token("'")
	]);

	var digits = repeat(1, range("0", "9"));

	var numberLiteral = capture(sequence([
		maybe(token("-")),
		digits,
		maybe(sequence([token("."), digits]))
	]));

	var literal = choice([numberLiteral, stringLiteral]);

	var applyParser = function(s, parser)
	{
		return parser(s, new ParserState(0, null));
	}

	// Order is important here: longer ops should be tried first.
	var opTerm = action(
		whitespaceSeparatedSequence([
			quotedFieldName,
			capture(choice([
				token("=="),
				token("!="),
				token("<>"),
				token("<="),
				token(">="),
				token("="),
				token("<"),
				token(">"),
				caseInsensitiveToken("LIKE")
			])),
			literal
		]),
		function(state)
		{
			// Linked list contains fieldname, operation, value
			// (in reverse order).

			var fieldName = state.tail.tail.head;
			var op = state.tail.head;
			var referenceValue = state.head;

			var matchPattern = null;
			if (op.toUpperCase() == "LIKE")
			{
				matchPattern = function(fieldValue)
				{
					var matchFrom = null;
					matchFrom = function(referenceIdx, fieldIdx)
					{
						var referenceChar = referenceValue.charAt(referenceIdx);
						var fieldChar = fieldValue.charAt(fieldIdx);
						if (referenceChar == "")
							return (fieldChar == "");
						else if (referenceChar == "%")
							return matchFrom(referenceIdx + 1, fieldIdx) || ((fieldChar != "") && matchFrom(referenceIdx, fieldIdx + 1));
						else 
							return (referenceChar == fieldChar) && matchFrom(referenceIdx + 1, fieldIdx + 1);
					}
					return matchFrom(0, 0);
				}
			}

			return function(props)
			{
				var fieldValue = props[fieldName];
				if (fieldValue == null)
					return false;
				if (matchPattern != null)
					return matchPattern(fieldValue);
				else if ((op == "=") || (op == "=="))
					return (fieldValue == referenceValue);
				else if ((op == "!=") || (op == "<>"))
					return (fieldValue != referenceValue);
				else
				{
					if (applyParser(referenceValue, numberLiteral).head == referenceValue.length)
					{
						var f1 = parseFloat(fieldValue);
						var f2 = parseFloat(referenceValue);
						if (op == "<")
							return (f1 < f2);
						else if (op == ">")
							return (f1 > f2);
						else if (op == "<=")
							return (f1 <= f2);
						else if (op == ">=")
							return (f1 >= f2);
						else
							return false;
					}
					else
					{
						var f1 = fieldValue;
						var f2 = referenceValue;
						if (op == "<")
							return (f1 < f2);
						else if (op == ">")
							return (f1 > f2);
						else if (op == "<=")
							return (f1 <= f2);
						else if (op == ">=")
							return (f1 >= f2);
						else
							return false;
					}
				}
			}
		}
	);

	var inTerm = action(
		whitespaceSeparatedSequence([
			quotedFieldName,
			caseInsensitiveToken("IN"),
			token("("),
			whitespaceSeparatedList(0, literal, token(",")),
			token(")")
		]),
		function(state)
		{
			// Linked list contains fieldname and multiple values
			//   (in reverse order).

			var node = state;
			while (node.tail != null)
				node = node.tail;
			var fieldName = node.head;

			return function(props)
			{
				var value = props[fieldName];
				if (value == null)
					return false;
				var node = state;
				while (node.tail != null)
				{
					if (node.head == value)
						return true;
					node = node.tail;
				}
				return false;
			}
		}
	);

	// Forward declarations to allow mutually recursive grammar definitions.
	var term = null;
	term = function(s, state) { return term(s, state); }
	var expression = null;
	expression = function(s, state) { return expression(s, state); }

	var notTerm = action(
		whitespaceSeparatedSequence([caseInsensitiveToken("NOT"), term]),
		function(state)
		{
			// Linked list contains only processed inner term.
			var innerTerm = state.head;
			return function(props)
			{
				return !innerTerm(props);
			}
		}
	);

	term = choice([
		notTerm,
		opTerm,
		inTerm,
		whitespaceSeparatedSequence([token("("), expression, token(")")])
	]);

	// AND and OR expressions must have at least 2 terms,
	//   to disambiguate them from a single term.

	var andExpression = action(
		whitespaceSeparatedList(2, term, caseInsensitiveToken("AND")),
		function(state)
		{
			// Linked list contains multiple processed inner terms
			//   (in reverse order).
			return function(props)
			{
				var flag = true;
				var node = state;
				while (node != null)
				{
					flag = flag && node.head(props);
					node = node.tail;
				}
				return flag;
			}
		}
	);
	
	var orExpression = action(
		whitespaceSeparatedList(2, term, caseInsensitiveToken("OR")),
		function(state)
		{
			// Linked list contains multiple processed inner terms
			//   (in reverse order).
			return function(props)
			{
				var flag = false;
				var node = state;
				while (node != null)
				{
					flag = flag || node.head(props);
					node = node.tail;
				}
				return flag;
			}
		}
	);

	// Order is important here: term should be tried last, 
	//   because andExpression and orExpression start with it.
	expression = choice([
		andExpression, 
		orExpression,
		term
	]);
	
	var whereClause = sequence([whitespace, expression, whitespace]);
	
	Parsers.parseSQL = function(str)
	{
		var result = applyParser(str, whereClause);
		if (result.head == str.length) 
			return result.tail.head;
		else
			return (applyParser(str, whitespace).head == str.length) ?
				function(props) { return true; } :
				null;
	}

	var additiveExpression = null;
	additiveExpression = function(s, state) { return additiveExpression(s, state); }
	var multiplicativeExpression = null;
	multiplicativeExpression = function(s, state) { return multiplicativeExpression(s, state); }
	additiveExpression = action(
		whitespaceSeparatedList(
			1,
			multiplicativeExpression,
			capture(choice([token("+"), token("-")]))
		),
		function(state)
		{
			return function(props)
			{
				var pos = state;
				var term = 0.0;
				while (pos != null)
				{
					term += pos.head(props);
					if (pos.tail == null)
						return term;
					else
					{
						if (pos.tail.head == "-")
							term = -term;
						pos = pos.tail.tail;
					}
				}
				return term;
			}
		}
	);

	var multiplicativeTerm = choice([
		action(
			numberLiteral,
			function(state)
			{
				return function(props)
				{
					return parseFloat(state.head);
				}
			}
		),
/*		
		action(
			sequence([token("round("), additiveExpression, token(")")]),
			function(state)
			{
				return function(props)
				{
					var res = state.head(props);
					return Math.round(res);
				}
			}
		),
*/		
		action(
			//whitespaceSeparatedSequence([token("floor("), additiveExpression, token(")")]),
			//sequence([token("floor("), maybe(whitespace), additiveExpression, maybe(whitespace), token(")")]),
			sequence([token("floor("), additiveExpression, token(")")]),
			function(state)
			{
				return function(props)
				{
					var res = state.head(props);
					return Math.floor(res);
				}
			}
		),
		action(
			sequence([token("["), fieldName, token("]")]),
			function(state)
			{
				return function(props)
				{
					return parseFloat(props[state.head]);
				}
			}
		),
		whitespaceSeparatedSequence([
			token("("),
			additiveExpression,
			token(")")
		])
	]);
	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			whitespaceSeparatedSequence([token("-"), multiplicativeTerm]),
			function(state)
			{
				return function(props)
				{
					return -state.head(props);
				}
			}
		)
	]);
	multiplicativeExpression = action(
		whitespaceSeparatedList(
			1,
			multiplicativeTerm,
			capture(choice([token("*"), token("/")]))
		),
		function(state)
		{
			return function(props)
			{
				var pos = state;
				var term = 1.0;
				while (pos != null)
				{
					term *= pos.head(props);
					if (pos.tail == null)
						return term;
					else
					{
						if (pos.tail.head == "/")
							term = 1.0/term;
						pos = pos.tail.tail;
					}
				}
				return term;
			}
		}
	);

	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			whitespaceSeparatedSequence([token("-"), multiplicativeTerm]),
			function(state)
			{
				return function(props)
				{
					return -state.head(props);
				}
			}
		)
	]);
/*	
	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			sequence([token("floor"), token("("), multiplicativeTerm, token(")")]),
			function(state)
			{
				return function(props)
				{
					var res = state.head(props);
					return Math.floor(res);
				}
			}
		)
	]);
*/	
	var arithmeticExpression = sequence([whitespace, additiveExpression, whitespace]);		
	Parsers.parseExpression = function(s)
	{
		var result = applyParser(s, arithmeticExpression);
		if (result.head == s.length) 
			return result.tail.head;
		else
			return null;
	}

	var svgPath = action(
		repeat(0, choice([
			numberLiteral,
			token(","),
			token("M"),
			token("C"),
			repeat(1, choice([
				token(" "),
				token("\t"),
				token("\r"),
				token("\n")
			]))
		])),
		function(state)
		{
			var coords = new Array();
			while (state != null)
			{
				coords.push(Std.parseFloat(state.head));
				state = state.tail;
			}
			coords.reverse();
			return coords;
		}
	);

	Parsers.parseSVGPath = function(s)
	{
		var result = applyParser(s, svgPath);
		if (result.head == s.length) 
			return result.tail.head;
		else
			return [];
	}

	//расширяем namespace
	gmxAPI.Parsers = Parsers;
})();
/*
//var str = '[test] + 23.45';
//var str = '1 + Math.floor([test] + 23.45)';
//var str = '1 + floor([_unixTimeStamp] + 23.4)*2 + round([_unixTimeStamp]/2 + 2.5)';
var str = 'floor(255*([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) + (1 - ([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200))*0)*256*256 + floor(255*([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) + (1 - ([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200))*0)*256 + floor(255*([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) + (1 - ([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200))*0)';
//var str = 'floor(255*( [_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) + (1 - ( [_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200) )*0)*256*256';
//var str = 'floor(([_unixTimeStamp] - 1339099200)/(1339185599 - 1339099200))';
//var str = 'floor((10.1))';
//var str = 'floor([_unixTimeStamp] - 1339099200/1339185599 - 1339099200)';
try {
var colorFunction = gmxAPI.Parsers.parseExpression(str);
} catch(e) {
var tt = e;
var tt = e;
}
var res = colorFunction({'_unixTimeStamp':1339185500, 'fdfdf': 'fff'});
var res = '[test] + 23';
*/