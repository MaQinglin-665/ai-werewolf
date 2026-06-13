export function speechMentionsBlackCheck(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}号`;
  return (
    new RegExp(`${targetText}.{0,10}(?:查杀|狼人)`).test(speech) ||
    new RegExp(`(?:查验|验了|验|摸了)\\s*${targetText}.{0,10}(?:查杀|狼人)`).test(speech)
  );
}

export function speechMentionsExplicitBlackCheck(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  return (
    new RegExp(`${targetText}[^。！？；]{0,20}(?:是|为|作为|这张牌是|这张)?.{0,6}查杀(?:位|牌|结果)?`).test(speech) ||
    new RegExp(`${targetText}[^。！？；]{0,24}(?:结果|查验结果|验出来|查出来)[^。！？；]{0,8}(?:是|为)?[^。！？；]{0,4}狼人`).test(speech) ||
    new RegExp(`${targetText}[^。！？；]{0,20}(?:是|为|作为|这张牌是|这张)?.{0,6}狼(?:人|牌)?`).test(speech) ||
    new RegExp(`查杀位[^。！？；]{0,8}${targetText}`).test(speech)
  );
}

export function offersBlackCheckReversalToTarget(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  const targetOrPronoun = `(?:${targetText}|他|这张牌|查杀位)`;
  const explanationCue = "(?:解释|讲清|说清|闭环|补|回应|自证|讲顺)";
  const reversalCue = "(?:改票|重新考虑|撤压力|放一轮|后移焦点|先不出|不压|票口后移)";
  return (
    new RegExp(`(?:如果|只要)${targetOrPronoun}.{0,28}${explanationCue}.{0,36}${reversalCue}`).test(speech) ||
    new RegExp(`${targetText}.{0,36}(?:如果|只要|能).{0,28}${explanationCue}.{0,36}${reversalCue}`).test(speech) ||
    /查杀位.{0,24}(?:自证|解释).{0,24}(?:改票|重新考虑|后移焦点|放一轮)/.test(speech) ||
    /(?:可改票条件|改票条件|解释能闭环则后移焦点)/.test(speech)
  );
}

export function hasSeerBlackCheckVoteBoundary(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  return (
    new RegExp(`${targetText}[^。！？；]{0,56}(?:票口|归票|压票|落票|投|出|推|先压|先走|今天票|今天先|外置位|硬身份反证|不分票|不散票|改结构|改变结构)`).test(speech) ||
    new RegExp(`(?:票口|归票|压票|落票|投|出|推|走|先压|先走|全票|今天票|今天先|外置位|硬身份反证|不分票|不散票|改结构|改变结构)[^。！？；]{0,56}${targetText}`).test(speech) ||
    new RegExp(`(?:今天我的票|我的票|票口)[^。！？；]{0,24}(?:你|他|她)[^。！？；]{0,12}${targetText}`).test(speech) ||
    /(?:票口|归票|压票|落票|今天票|今天先|今天我投|我的票|我会投|我要投|全票|外置位|硬身份反证|不分票|不散票|改结构|改变结构)/.test(speech) ||
    new RegExp(`今天[^。！？；]{0,24}${targetText}[^。！？；]{0,24}(?:必须|要|先)?[^。！？；]{0,12}(?:正面)?(?:接|回应)[^。！？；]{0,18}(?:我的)?(?:查验|结果|查杀)`).test(speech) ||
    /今天[^。！？；]{0,24}(?:必须|要|先)?[^。！？；]{0,12}(?:正面)?(?:接|回应)[^。！？；]{0,18}(?:这个)?(?:结果|查杀)/.test(speech) ||
    /全桌[^。！？；]{0,24}(?:怎么处理|处理)[^。！？；]{0,24}(?:从|看)[^。！？；]{0,18}(?:回应|接)/.test(speech)
  );
}

export function dilutesSeerBlackCheckWithObserverCondition(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  const sentences = speech.split(/[。！？；]/).map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.some((sentence) => {
    const mentionsTarget = new RegExp(targetText).test(sentence) || /查杀位|查杀/.test(sentence);
    if (!mentionsTarget && !/(?:外置位|有人|别人|之后|后面|后续)/.test(sentence)) return false;
    return (
      new RegExp(`(?:先别急着|别急着|不要急着|暂时别|先不急着).{0,18}(?:把|让)?${targetText}.{0,16}(?:放过去|轻放|放一轮|放掉|过掉)`).test(sentence) ||
      /(?:除非|只有|如果|要是)[^。！？；]{0,36}(?:更硬的?身份信息|硬身份反证|直接反跳预言家|反跳预言家|公开反证)[^。！？；]{0,24}(?:否则|才|改变结构|改结构|改变处理|改判)/.test(sentence) ||
      /(?:外置位|有人|别人)[^。！？；]{0,24}(?:更硬的?身份信息|硬身份反证|直接反跳预言家|反跳预言家|公开反证)/.test(sentence) ||
      /(?:讨论|桌面|结构)[^。！？；]{0,12}(?:应该|先)[^。！？；]{0,18}(?:压住|围绕|处理)[^。！？；]{0,12}(?:这个位置|查杀位)/.test(sentence)
    );
  });
}

export function activelyExplainsFirstCheckMotive(speech: string, targetSeatId: number): boolean {
  const targetText = `${targetSeatId}\\s*号`;
  const makesFirstCheckTopic =
    /(?:不展开|不主动展开)[^。！？；]{0,18}(?:第一晚|首夜|首验)[^。！？；]{0,24}(?:为什么|理由|心路|选|验|查)/.test(
      speech,
    ) ||
    /(?:第一晚|首夜|首验)[^。！？；]{0,24}(?:为什么|理由|心路)[^。！？；]{0,24}(?:不展开|不主动展开|不聊|不说)/.test(
      speech,
    );
  if (makesFirstCheckTopic) {
    return true;
  }
  if (/(?:不作为(?:桌面)?主攻点|不是核心|不是主要|不是今天主线|不作(?:为)?今天主线|非今天主线)/.test(speech)) {
    return false;
  }
  return (
    new RegExp(`(?:选|选择|挑|查|验)[^。！？；]{0,18}${targetText}[^。！？；]{0,36}(?:理由|因为|原因|发言顺序|中间偏前|位置|空白|藏)`).test(speech) ||
    new RegExp(`${targetText}[^。！？；]{0,36}(?:理由|因为|原因|发言顺序|中间偏前|位置|空白|藏)`).test(speech) ||
    /(?:我选|选择|挑了|选她|选他|选这个位置|验她|验他|查她|查他)[^。！？；]{0,36}(?:理由|因为|原因|发言顺序|中间偏前|位置|空白|藏)/.test(
      speech,
    ) ||
    /(?:验人理由|首验理由|查验理由|选人理由)[^。！？；]{0,8}(?:是|因为|来自|在于)/.test(speech) ||
    /(?:首验选|首夜选|第一晚选|第一晚验)[^。！？；]{0,18}(?:是|因为|我自己的判断|判断)/.test(speech) ||
    /(?:首夜|第一晚)[^。！？；]{0,36}(?:理由|因为|原因|发言顺序|中间偏前|位置|空白|藏)/.test(speech)
  );
}

export function misidentifiesSeatAsSeer(speech: string, seatId: number): boolean {
  const seatPattern = `${seatId}\\s*号`;
  const shortSameSeatPhrase = "(?:(?!\\d{1,2}\\s*号).)";
  return speech.split(/[。！？；]/).some((sentence) => {
    if (isNegativeSeerAttribution(sentence, seatPattern)) return false;
    return (
      new RegExp(
        `(?:暂时|先|更|比较|倾向)?(?:认|站|信|保|支持|认可)${shortSameSeatPhrase}{0,12}${seatPattern}${shortSameSeatPhrase}{0,12}(?:是|为)?\\s*(?:预言家|预言家牌)`,
      ).test(
        sentence,
      ) ||
      new RegExp(
        `${seatPattern}${shortSameSeatPhrase}{0,12}(?:这张|这个|这位)?(?:预言家|预言家牌)${shortSameSeatPhrase}{0,18}(?:可信|成立|像真|更真|我认|我站|先认|更信)`,
      ).test(
        sentence,
      ) ||
      new RegExp(
        `(?:我认为|我觉得|我判断|我暂时认|我先认)${shortSameSeatPhrase}{0,12}${seatPattern}${shortSameSeatPhrase}{0,8}(?:是|为)\\s*(?:预言家|预言家牌)`,
      ).test(
        sentence,
      )
    );
  });
}

function isNegativeSeerAttribution(sentence: string, seatPattern: string): boolean {
  return (
    new RegExp(`(?:不认|不站|不信|别认|别站|别信|不是|不像|不可能是).{0,12}${seatPattern}.{0,12}(?:预言家|预言家牌)`).test(sentence) ||
    new RegExp(`${seatPattern}.{0,12}(?:不是|不像|不可能是|不配认).{0,12}(?:预言家|预言家牌)`).test(sentence)
  );
}
