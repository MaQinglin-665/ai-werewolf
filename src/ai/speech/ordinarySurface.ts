export function normalizeOrdinarySurfaceForCopyCheck(text: string): string {
  return text
    .replace(/“[^”]{0,160}”/g, "")
    .replace(/"[^"]{0,160}"/g, "")
    .replace(/\d+\s*号[A-Za-z\u4e00-\u9fff_-]{0,18}/g, "X号")
    .replace(/(?:DeepSeek|Claude|GPT|豆包|Mimo|Gemini)/g, "")
    .replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
}

export function hasSharedSurfaceSpan(left: string, right: string, minLength: number): boolean {
  if (left.length < minLength || right.length < minLength) return false;
  let previous = new Array(right.length + 1).fill(0) as number[];
  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array(right.length + 1).fill(0) as number[];
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] !== right[j - 1]) continue;
      current[j] = previous[j - 1] + 1;
      if (current[j] >= minLength) return true;
    }
    previous = current;
  }
  return false;
}

export function hasOrdinaryCardSurface(text: string): boolean {
  return /(?:听着卡|有点卡|最卡|卡(?:的|住|得|了我一下|了一下|一下|这句|这个点|的是|在)|我卡|先卡)/.test(text);
}

export function hasOrdinaryHandlingAction(speech: string): boolean {
  return /(?:先不(?:投|压|跟|定|打死|站死|归死)|不急(?:着)?(?:投|压|跟|定|站死|归死)|暂放|暂时放|先放一下|先认|我认|追问|问\d+\s*号|票(?:口|投|压)|投|压|跟压|解释|回应|改口|先过|我过|过了|带票|带节奏|带方向|出人|归票|保留|放一轮|听进来|不跟)/.test(
    speech,
  );
}

export function hasOrdinaryFinalLandingAction(speech: string): boolean {
  const tail = ordinaryFinalLandingWindow(speech);
  return /(?:所以|那我|我(?:这轮|今天|现在|先)?|这票|票)[^。！？；]{0,72}(?:先不(?:投|压|跟|定|打死|站死|归死)|不急(?:着)?(?:投|压|跟|定|站死|归死)|暂放|暂时放|先放一下|先认|我认|我先看|我改看|我先盯|我先压|我压|我投|我不跟|票(?:口|投|压)|先过|我过|过了|保留|放一轮|不跟)/.test(
    tail,
  );
}

function ordinaryFinalLandingWindow(speech: string): string {
  const tail = speech.slice(-190);
  const pivotIndex = [
    "但我想",
    "但今天",
    "但是我想",
    "不过我想",
    "问题是",
    "我想把镜头转一下",
    "我想顺着",
    "我想转回",
    "我重新听",
    "我回头看",
    "这个观察我听进去了",
  ].reduce((latest, marker) => Math.max(latest, tail.lastIndexOf(marker)), -1);
  return pivotIndex >= 0 ? tail.slice(pivotIndex) : tail.slice(-140);
}

export function isOrdinaryTruncatedSpeechEnding(clean: string): boolean {
  if (!clean) return false;
  if (hasOrdinaryForwardCommitmentEnding(clean)) return true;
  if (hasOrdinaryForwardCommitmentOnlyRestatement(clean)) return true;
  if (
    /(?:我(?:这轮|现在)?主要想(?:说|聊|点(?:一下)?)|我重点想(?:说|聊|点(?:一下)?))\s*\d{1,2}号?(?:[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})[。！？!?]?$/.test(
      clean.slice(-72),
    )
  ) {
    return true;
  }
  if (hasUnresolvedOrdinaryContrast(clean)) return true;
  if (/[。！？!?」』”"）)]$/.test(clean)) return false;
  const tail = clean.slice(-36);
  return (
    /(?:我先把|我把|先把|我会把|我想把|我准备把|我这轮把)\s*\d{1,2}(?:号)?$/.test(tail) ||
    /(?:我先把|我把|先把|我会把|我想把|我准备把|我这轮把)\s*\d{1,2}号?[A-Za-z0-9_-]{0,16}$/.test(tail) ||
    /(?:卡住了|卡在|问题是|重点是|疑问是|我想问|我想听|听不懂的是|没接上的是)[:：,，、；;\s]*\d{1,2}(?:号)?[A-Za-z0-9_-]{0,16}$/.test(tail) ||
    /(?:我倒想知道|倒想知道|我想知道|想知道|我想听听|想听听)$/.test(tail) ||
    /(?:能撑住的)?(?:只有|只剩|剩下的只有|我能认的只有)$/.test(tail) ||
    /(?:我(?:现在|这轮)?想转一下视线|转一下视线|原话我再过一遍|刚才那段原话我再过一遍|我再过一遍)$/.test(tail) ||
    /(?:你|我|他|她|它|这里|这边)?(?:留了|留下|留着)$/.test(tail) ||
    /(?:刚才|前面|上一位)?[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16}(?:说|讲|提|点)(?:的|到的)?$/.test(tail) ||
    /(?:你铺的|你说的|刚才那|前面那|这|那)(?:句|句话|段|个点|个观察点)$/.test(tail) ||
    /(?:说|提|讲)?(?:[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:那句|这句|那句话|这句话)$/.test(tail) ||
    /(?:^|[，,。！？!?；;\s])(?:你|他|她|它|[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:刚才|前面|后面)?(?:又)?说$/.test(tail) ||
    /(?:但|但是|不过|可是|可)[^。！？；]{0,32}(?:你|他|她|它|[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?(?:后面|前面|刚才)?又说$/.test(tail) ||
    /(?:别|不要|不能|不是|不该)(?:只|光|空)?(?:说|喊|跟|认|保|压)$/.test(tail) ||
    /(?:但|但是|不过|可是|然而|所以|因为|如果|而且|比如|例如|我想问|我想听|想听|我的问题是|卡我的是|重点是|先把|我先把)[:：,，、；;\s]*$/.test(tail)
  );
}

export function hasOrdinaryForwardCommitmentEnding(clean: string): boolean {
  return Boolean(findOrdinaryForwardCommitmentTail(clean));
}

export function findOrdinaryForwardCommitmentTail(clean: string): { index: number; sentence: string } | undefined {
  const withoutClosingPunctuation = clean.replace(/[。！？!?；;]+$/g, "").trim();
  if (!withoutClosingPunctuation) return undefined;
  const boundaryIndex = Math.max(
    withoutClosingPunctuation.lastIndexOf("。"),
    withoutClosingPunctuation.lastIndexOf("！"),
    withoutClosingPunctuation.lastIndexOf("？"),
    withoutClosingPunctuation.lastIndexOf("；"),
    withoutClosingPunctuation.lastIndexOf(";"),
    withoutClosingPunctuation.lastIndexOf("!"),
    withoutClosingPunctuation.lastIndexOf("?"),
    withoutClosingPunctuation.lastIndexOf("，"),
    withoutClosingPunctuation.lastIndexOf(","),
  );
  const index = boundaryIndex >= 0 ? boundaryIndex + 1 : 0;
  const sentence = withoutClosingPunctuation.slice(index).trim();
  return isOrdinaryForwardCommitmentSentence(sentence) ? { index, sentence } : undefined;
}

function isOrdinaryForwardCommitmentSentence(sentence: string): boolean {
  const clean = sentence.replace(/\s+/g, "");
  return (
    /^(?:我)?(?:先)?(?:说|讲|解释|交代)(?:一下)?(?:我)?为什么(?:现在|这时候|这个时候)?(?:要)?(?:跳|拍|报)(?:身份|女巫|预言家|猎人)?$/.test(
      clean,
    ) ||
    /^(?:我)?(?:接下来|后面|下面)(?:先)?(?:说|讲|解释|聊)(?:一下)?(?:为什么|这个点|我的理由|我的想法)?$/.test(clean) ||
    /^(?:我)?(?:现在|这轮|今天)?(?:想|准备|打算)(?:换|转)(?:个|一个)?(?:方向|角度|视角)(?:看|聊|听)?$/.test(clean) ||
    /^(?:我)?(?:还)?有(?:个|一个)?(?:更)?(?:让|令)?我(?:更)?(?:不舒服|别扭|卡住|没听明白)(?:的)?(?:地方|点|一件事|问题)?$/.test(
      clean,
    )
  );
}

function hasOrdinaryForwardCommitmentOnlyRestatement(clean: string): boolean {
  const sentences = (clean.match(/[^。！？；;]+[。！？；;]?/g) ?? [])
    .map((sentence) => sentence.replace(/[。！？；;]+$/g, "").trim())
    .filter(Boolean);
  if (sentences.length < 2) return false;
  for (let index = 0; index < sentences.length - 1; index += 1) {
    if (!isOrdinaryForwardSetupSentence(sentences[index]!)) continue;
    const tail = sentences.slice(index + 1);
    if (tail.length === 0 || tail.length > 2) continue;
    if (tail.every(isPublicInfoRestatementWithoutOwnHandling)) return true;
  }
  return false;
}

function isOrdinaryForwardSetupSentence(sentence: string): boolean {
  const clean = sentence.replace(/\s+/g, "");
  return (
    /^(?:但|不过)?(?:我)?(?:现在|这轮|今天)?(?:不舒服|别扭|卡住|没听明白|想说|想聊|想看|想问|要说|要讲)(?:的是|的点是|的是另一件事|另一件事|一个点|这个点|一件事)?$/.test(
      clean,
    ) ||
    /^(?:但|不过)?(?:我)?(?:还)?有(?:个|一个)?(?:更)?(?:让|令)?我(?:更)?(?:不舒服|别扭|卡住|没听明白)(?:的)?(?:地方|点|一件事|问题)?$/.test(
      clean,
    )
  );
}

function isPublicInfoRestatementWithoutOwnHandling(sentence: string): boolean {
  if (!/(?:\d{1,2}\s*号|[A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})/.test(sentence)) return false;
  if (!/(?:说|跳|拍|报|救|验|投|票|是|银水|金水|查杀|倒牌|出局|放逐|平安夜|狼刀|女巫|预言家)/.test(sentence)) {
    return false;
  }
  return !/(?:我(?:先|这轮|今天|现在)?[^。！？；]{0,24}(?:投|票|压|问|追|看|盯|认|不认|怀疑|暂放|放下|转|改|保留|需要)|(?:所以|因此|这轮|今天)[^。！？；]{0,24}(?:投|票|压|问|追|看|盯|认|不认|怀疑|暂放|放下|转|改|保留|需要)|(?:疑点|问题|没说清|哪里不对|哪里没落地))/.test(
    sentence,
  );
}

function hasUnresolvedOrdinaryContrast(clean: string): boolean {
  return (
    /(?:我(?:现在|这轮)?想转一下视线|转一下视线|原话我再过一遍|刚才那段原话我再过一遍|我再过一遍|背后藏着一个前提[^。！？；]{0,40}|我记到现在|(?:能撑住的)?(?:只有|只剩|剩下的只有|我能认的只有))[。！？!?]?$/.test(
      clean,
    ) ||
    /(?:有个点|有个地方|有一点|这点|这里)[^。！？；]{0,24}(?:没听明白|不明白|听不懂)[\s\S]{0,160}(?:这部分|这个部分|这里|这句|这一句)[^。！？；]{0,12}(?:我)?(?:理解|能理解|先认|听懂)[。！？]?$/.test(
      clean,
    ) ||
    /(?:但|但是|不过|可是)[^。！？；]{0,140}(?:方向|表态|追问|那句|这句|这句话|那个点|这个点)[^。！？；]{0,34}(?:有点|比较|确实){0,2}(?:问题|模糊|奇怪|怪|不对劲)[。！？]?$/.test(
      clean,
    ) ||
    /(?:重新听|回头再看|再看|听了几遍|我重新听)[\s\S]{0,180}(?:原话|那句|这句|句话)[\s\S]{0,120}(?:越想越不对|越听越不对|越想越怪|越听越怪|有点不对|不对劲|有点怪|奇怪|不舒服|别扭)[。！？]?$/.test(
      clean,
    ) ||
    /(?:[0-9]+号[A-Za-z0-9_\-\u4e00-\u9fa5]{0,16})?[^。！？；]{0,24}(?:刚才|前面)?(?:那句|这句|那句话|这句话|那段|这段|发言|话)[^。！？；]{0,30}(?:我)?(?:有点|比较|确实)?(?:没听明白|不明白|听不懂)[。！？]?$/.test(
      clean,
    ) ||
    /(?:听着|听起来|我觉得|我感觉)[^。！？；]{0,28}(?:有点|比较|挺)?(?:怪|奇怪|别扭|不舒服|不对劲)[\s\S]{0,180}(?:你说|他说|她说|刚才说)[^。！？；]{0,120}[”"」』][。！？]?$/.test(
      clean,
    )
  );
}
