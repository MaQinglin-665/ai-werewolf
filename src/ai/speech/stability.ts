import { trimLlmOutputForRetry } from "../modelLlms";

import { buildClaimAttributionBoundaryLinesFromClaimBoard } from "./claimAttribution";
import { seatText } from "./text";
import type { LlmSpeechInput } from "./types";

export function withSpeechStabilityHint(
  input: LlmSpeechInput,
  attempt: number,
  previousIssue: string,
  previousOutput: string | undefined,
): LlmSpeechInput {
  if (attempt <= 1) return input;
  return {
    ...input,
    stability: {
      attempt,
      previousIssue,
      previousOutput: trimLlmOutputForRetry(previousOutput),
      expectedFormat: "{\"speech\":\"你的公开发言\"}",
      repairInstructions: buildSpeechRepairInstructions(input, previousIssue),
      speechContract: {
        move: input.speechContract.move,
        target: input.speechContract.target,
        mustSay: input.speechContract.mustSay,
        mayAsk: input.speechContract.mayAsk,
        mustNotAsk: input.speechContract.mustNotAsk,
        voteBoundary: input.speechContract.voteBoundary,
      },
    },
  };
}

export function buildSpeechRepairInstructions(input: LlmSpeechInput, previousIssue = ""): string[] {
  const contract = input.speechContract;
  const targetText = contract.target ? seatText(contract.target) : "无目标";
  const lines = [
    `必须执行 speechContract.move=${contract.move}，不要改成其他发言动作。`,
    `目标=${targetText}；targetSpeechStatus=${contract.targetSpeechStatus}；allowedInteraction=${contract.allowedInteraction}。`,
  ];
  if (input.characterRole?.theme === "class-trial") {
    const displayName = input.characterLens?.displayName ?? input.characterRole.displayName;
    lines.push(
      `学级裁判角色修复：保留${displayName}的临场判断和角色语气，让 LLM 自由发挥；只修掉 previousIssue 指出的越界点，不要改成模板兜底句。`,
      "删除内部审计词；换成角色能说出口的一句具体压力、保留或验证条件。",
    );
    if (/D1首验理由不是主要攻击点/.test(previousIssue)) {
      lines.push(
        "修复D1查杀回应错误：不要围绕夜间选人过程发问或攻击。改成看查杀位如何回应、有没有预言家对跳、这条查杀今天怎么处理，或谁公开和结果对撞。",
        "首验理由相关词整句删除，连“先不追这个”也不要说；只看查杀位回应、有没有对跳、谁救或改焦点。",
      );
    }
    if (/平安夜女巫用药不能作为完整发言/.test(previousIssue)) {
      lines.push(
        "修复平安夜完整发言：不要把平安夜、女巫用药、药瓶、无人倒牌写成一整段；最多一句背景后立刻转到公开发言里没说清的地方。",
        "如果同时踩到首验理由和平安夜，整段重写为：接住查杀结果，只看查杀位怎么回应、谁救人、谁改焦点；不要再复用上一轮原文。",
      );
    }
    if (/D1首跳查杀未对跳前不要反压预言家/.test(previousIssue)) {
      lines.push(
        "修复雾切早期查杀反应：不要评价首跳预言家票压太死、查杀站不站得住或自己跟不跟。把查杀暂作桌面硬信息，点被查杀位正面接，再观察对跳、救人和改焦点的人。",
        "句子里不要对苗木诚说“为什么”“你急着”“封死”“归死”“不替你封死”。问题只留给查杀位、后续对跳者、救人者或改焦点者。",
      );
    }
    if (/被查杀位回应不要复述平安夜/.test(previousIssue)) {
      lines.push("修复被查杀回应：删掉平安夜、女巫用药、药线背景；只回应谁报你查杀、你为什么不认、你今天怎么反打或活下来。");
    }
    if (/D1平安夜只能作背景，不当主要疑点或查杀依据/.test(previousIssue)) {
      lines.push("修复平安夜攻击轴：整段删掉平安夜、女巫用药、药瓶、安全网；改审对跳时机、谁接话太顺、谁替查杀位改焦点，或本角色自己的舞台/标准/下注/声音动作。");
    }
    if (/学级裁判后置位不要复盘整条查杀流水账/.test(previousIssue)) {
      lines.push(
        "修复后置流水账：不要按顺序复盘平安夜、苗木、雾切、腐川、黑白熊；开头直接点一个目标，用角色自己的下注、标准、声音或关系压力推进。",
        "最多点两个座位或名字；不要写“从1号开始/后面三个人/2号、4号、7号、8号”这种名单式复盘。",
      );
    }
    if (/学级裁判后置位不要复读首跳查杀轴/.test(previousIssue)) {
      lines.push(
        "修复后置复读：不要再从“首置位跳预言家报查杀/查杀接法”开头。直接抓刚才跟压者、救人者、改焦点者，或用角色自己的欲望制造一个新压力点。",
      );
    }
    if (/学级裁判后置位不要继续追同一个查杀位自证问题/.test(previousIssue)) {
      lines.push(
        "修复连续追问：同一个查杀位已经被多人追问怎么自证/跳身份了；这轮改打跟压者、救人者、改焦点者，或指出谁在用同一个问题制造票压。",
      );
    }
    if (/学级裁判后置位不要连续追同一个跟压者/.test(previousIssue)) {
      lines.push(
        "修复连续转靶：同一个跟压者已经被多人追过同一处标准/看戏/两头站问题；这轮改审上一位为什么还在复读，或换到另一个救人、跟注、改焦点的人。",
      );
    }
    if (/学级裁判后置位不要复制前置发言句式/.test(previousIssue)) {
      lines.push(
        "修复复制句式：不要沿用前一位的问法、三连问、比喻或句子骨架。保留同一局势也必须换成本角色动作：雾切切证词、十神定合格线、江之岛推上舞台、塞蕾丝下注、高松听断点、爱音拉关系链。",
      );
    }
    if (/D2学级裁判不要复读同一票口问法链/.test(previousIssue)) {
      lines.push(
        "修复D2复读链：不要再复述票口、筹码、问句藏结论这套问法；改成揭示谁借问句回避，或换成本角色动作推进。",
        "如果你是在指出重复，必须给新的归因、压力或动作，不要尾句继续写“你自己呢”。",
      );
    }
    if (/误读前置位对未发言座位的保留态度/.test(previousIssue)) {
      lines.push(
        "修复未发言位误读：前置位明确说不提前压未发言位时，不要说他点了该未发言位；改成他压的是已发言目标，或评价他的急迫感、达标线、转焦点动作。",
      );
    }
    if (/把本轮未发言的\d+号当成已发言评价/.test(previousIssue)) {
      lines.push(
        "修复未发言位：该座位本轮还没开口，不能写“到现在没说/一个字没说/没回应/反应如何”；只能说“轮到他时正面接这个结果”，或改审已经发言者为什么提前替他定性。",
      );
    }
    if (/要求已发言的\d+号后续补充发言/.test(previousIssue)) {
      lines.push(
        "修复已过麦追问：被你点到的人本轮已经发言，不能再写“你补、你解释、你信不信、你改不改票、你票口在哪里”。",
        "改成按他已经说出口的内容下判断：我暂挂、我压票、我不认、我看谁借这句话跟风；如果要设条件，条件给后续未发言者或全桌票型，不给已过麦者补话任务。",
        "如果是在评论后置追问，记住后置追问发生在目标发言之后，不能写他没接完、没回应或等他补完；改成评价后置位如何制造压力。",
      );
    }
    if (/把\d+号发言后的追问说成\d+号未回应/.test(previousIssue)) {
      lines.push(
        "修复后置追问时间线：后置追问发生在目标发言之后，不能写他没接完、没回应、接不住或等他补完。",
        "改成评价后置位正在用这条追问制造压力，或看谁顺着这条后置压力跟票；不要把后置追问当成目标已经漏答。",
      );
    }
    if (/D1预言家不应主动展开首验理由/.test(previousIssue)) {
      lines.push("修复预言家D1报验错误：只说身份、目标、结果和今天处理方式；不要解释夜间选人过程，也不要声明自己为什么不解释。");
    }
    if (
      /(?:计划预言家声明没有说清身份线|没有覆盖计划中的查验结果|speechContract要求报出\d+号查杀|预言家查杀缺少今天如何处理查杀位)/.test(
        previousIssue,
      ) &&
      contract.move === "claim_black_check" &&
      contract.target
    ) {
      lines.push(
        `修复计划悍跳：第一句就跳预言家，明确说“${targetText}是查杀”，并给出今天票先压/谁保谁对撞；不要再点评别人来替代悍跳。`,
        `优先输出这条硬合同：我跳预言家，昨晚验出${targetText}查杀。今天票先压${contract.target.seatId}号；谁保${contract.target.seatId}号，就和我的结果对撞。`,
      );
    } else if (/计划预言家声明没有说清身份线/.test(previousIssue) && contract.move === "claim_gold_check" && contract.target) {
      lines.push(
        `修复预言家报金水：第一句明说“我是预言家”，再说“昨晚验了${targetText}，${targetText}是金水”。`,
        "不要只说“先报身份”或只报验人结果；普通玩家听到身份词才知道这是预言家声明。",
      );
    } else if (/speechContract要求报出\d+号查杀/.test(previousIssue) && contract.target) {
      lines.push(`修复查杀表达：必须自然说清“${targetText}是查杀”或“${targetText}结果是狼人”，不要只说重点观察或只说这张牌。`);
    }
    if (/腐川十神关系缺少公开触发/.test(previousIssue)) {
      lines.push("修复腐川越界：本轮没有公开十神触发时，不提十神；只回应当前查杀、质疑或公开发言。");
    }
    if (/把未公开身份的\d+号说成.+声明者/.test(previousIssue)) {
      lines.push("修复身份归属：没有公开身份声明的位置不要说跳、对跳、跟跳、明牌；改成点评、质疑、施压、保留或转移话题。");
    }
    if (/发言过于冗长或报告化/.test(previousIssue)) {
      lines.push("修复报告化：删掉列表和总结腔，保留角色反应、公开判断和一个可接住的动作。");
      if (contract.move === "identity_claim" && /猎人|枪/.test(contract.mustSay.join("\n"))) {
        lines.push("硬拍猎人修复：最多两句。第一句“我拍猎人，枪在这里。”第二句只给一个票口或压人标准。");
      }
    }
  }
  if (/普通局发言不要像全桌复盘|普通局发言黑话堆叠/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局修复口吻：改成普通玩家第一人称，只说我听到了什么、我为什么不舒服、我这轮先看谁。",
      "删掉全桌视角、上帝视角、收益来源、发言链、闭合、收口、压力源这些内部词；换成哪句话没听懂、谁把话说太满、我最后想压哪里。",
      "必要术语可以保留，例如平安夜、女巫、银水、对跳、查杀、金水、票口；但不要把术语堆成复盘报告。",
    );
  }
  if (/普通局不要把内部审稿词说出口/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局审稿词修复：删掉“这句话本身、观察位、观察条件、发言缺口、身份空间、怎么用这个信息、起票补票最后跟票、划线、触线、收口、收一下票型”这类台下词。",
      "改成桌上玩家能说出口的动作：我听着怪、我没接住、我先不跟、我先暂放、我今天先压谁。",
      "如果引用前置位原话，引用后必须补一句自己怎么处理：先不跟、先暂放、先压票、改看后面谁借这个点带票。",
    );
  }
  if (/普通局改口必须说清新判断/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局改口修复：改口后必须立刻说新判断，例如“1号我先不压了”“我改看后面谁借这个点带票”“今天票先不跟2号”。",
      "不要只引用前置发言、不要只解释为什么要改；引用后必须给新的怀疑、暂放、投票边界或观察方向。",
    );
  }
  if (/普通局认同一半必须说清落点/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局半接受修复：认一半后必须说清三件事：我认哪一半、我不全跟哪一半、我现在怎么处理。",
      "不要只说“我先认一半但不站死”；改成“身份我暂认，但票口我不跟；今天先不压4号/先听4号自己怎么说”。",
    );
  }
  if (/普通局不要连续围绕同一句做同质审计/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局同轴复读修复：同一句已经被多人打过，不要继续围绕同一个座位同一句话审计。",
      "这轮必须换动作或换焦点：看谁在跟票、谁没有新增理由、谁只复述身份说法，或把原焦点暂放一轮。",
    );
  }
  if (/D1首验理由不是主要攻击点/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局D1首验理由修复：不要再追问或攻击为什么首验、验人心路、选人理由、公开依据或查验逻辑。",
      "改成看查杀位怎么回应、有没有预言家对跳、谁救查杀位、谁跟压省理由，或今天这条查杀票怎么处理。",
      "句子里不要再写“首验理由/验人理由/验人心路/为什么验/凭什么验”；只处理公开结果和白天反应。",
    );
  }
  if (/普通局发言疑似被截断/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局截断修复：上一轮像半句话停住了，必须补完最后一个判断。",
      "如果最后是在引用别人原话，引用后必须接“所以我这轮怎么处理”：先不跟、先暂放、先压谁、或把票点落到谁。",
      "如果最后只是说“没听明白/不舒服/别扭”，必须补具体原因：哪句话没接住、它和前面哪句不一致、你这轮先暂放还是先压谁。",
      "如果最后只是“我主要想说/聊/点一下某号”，点名后必须补一句具体判断或处理动作：我信不信、暂不暂放、压不压、今天怎么处理。",
    );
  }
  if (/普通局死亡形态不要展开规则课|普通局发言必须推进一个游戏动作/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局死亡形态修复：只一句处理死亡形态，然后马上接一个具体游戏动作。",
      "无守卫女巫首夜单死写成“狼刀成功，女巫没救”；平安夜写成“女巫用了救药”。不要解释夜间规则前提、低概率药线、具体刀毒重合、空刀或首夜狼刀意图。",
      "后半句必须落到玩家动作：怀疑谁、暂放谁、追问谁、轻疑一个已发言的人，或给一个投票条件。不要只复述死讯或规则。",
    );
  }
  if (/平安夜女巫用药是公共死亡形态推理/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局平安夜公共常识修复：不要质疑别人说“女巫用了救药”的依据、信息来源或是不是纯推理；这是平安夜的公共死亡形态处理。",
      "如果要打这个人，只能打他拿平安夜之后做了什么：有没有马上硬压人、有没有跳过自己的判断去安排别人表态、有没有把自己的判断交给别人。",
    );
  }
  if (/普通局平安夜不要展开刀口和女巫行动规则课/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局平安夜修复：删掉狼队知道刀口、闭眼视角、女巫行动揣测这些夜间规则课。",
      "只保留一句“平安夜我先当背景/不拿它定人”，然后接自己的动作：暂放、先不定人、我现在听不出来；首置位不要问下一位或远后置位怎么看。",
    );
  }
  if (/普通局首置位不要设置未来观察点/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局首置位修复：你是低信息第一麦，允许说完就停；不要再补“等后面说完我看谁前后不对/谁反应不自然/谁没说清楚”。",
      "改成一句自己的当前处理：我现在信息少，平安夜先当背景；这轮先不压票/先听一圈/我现在听不出来。",
    );
  }
  if (/普通局低信息首置位不要点名后置位布置任务|普通局低信息不要跳过下一位直接布置后置任务/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局首置位修复：你是低信息第一麦，删掉具体座位号和“轮到你/我想听你/你怎么看/你的回答”这类后置作业。",
      "改成只说自己的动作：平安夜先当背景、我先不定人、我先听一圈再说、这轮先不压票。",
      "如果已经有人发言，才可以接上一位原话问下一位一个具体问题；首置位没有原话可接，不要点名后置位。",
    );
  }
  if (/普通局低信息首置位划水不应成为主要攻击点/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局低信息划水修复：首置位只说信息少、先听一圈、不急定人时，这是可接受的水发言，不要只因为短、没票口、没过程去压他。",
      "改成转回你自己的临时处理，或改看已经出现的身份声明、跟压重复、票口分歧；不要继续问首置位后面怎么补。",
    );
  }
  if (/普通局后置位不要复读同一发言缺口/.test(previousIssue)) {
    lines.push(
      "普通局修复复读链：不要再复述“只有一个人发言/压力源在哪/观察点没有来源”这句话。",
      "改成审刚才谁在复读、谁跟压却没有新增理由、谁借这条压力转票，或转向身份说法、票型动机、反应差。",
      "可以保留对原焦点的观察，但必须新增一个不同动作；不要把同一句质疑换座位号再说一遍。",
    );
  }
  if (/要求已发言的\d+号后续补充发言/.test(previousIssue) && input.characterRole?.theme !== "class-trial") {
    lines.push(
      "普通局修复时序：已经发过言的人本轮不会再立刻补充，不能写“你后面给方向/你再解释/你补站边/你打算怎么接”。",
      "改成直接按他已经说出口的原话下判断：先认、挂观察、压票、看谁跟风、或把条件交给尚未发言的后置位和之后票型。",
      "如果要保留问题，问题只能给尚未发言的人；对已发言的人只说“这句我先挂/我暂认/我不认/我按这个点压”。",
    );
  }
  if (/普通局非首发位不要自称首置位|普通局不要复刻前置位低信息开场/.test(previousIssue)) {
    lines.push(
      "普通局修复低信息复刻：如果前面已经有人发言，不能说“我首置位/我第一个发言/没前置发言可抓”。",
      "不要再复刻“平安夜，女巫用药了，这个先放着/看后置位整体/谁借平安夜带节奏”这套开场。",
      "改成接住上一位的具体原话、指出复制粘贴现象、审跟压收益、看身份收益或给一个新的票型验证条件。",
    );
  }
  if (contract.mustSay.length > 0) {
    lines.push(`必须说到：${contract.mustSay.join("；")}`);
  }
  if (contract.mayAsk.length > 0) {
    lines.push(`只能这样追问：${contract.mayAsk.join("；")}`);
  }
  if (contract.mustNotAsk.length > 0) {
    lines.push(`禁止：${contract.mustNotAsk.join("；")}`);
  }
  for (const attributionLine of buildClaimAttributionBoundaryLinesFromClaimBoard(input.publicContext.claimBoard)) {
    lines.push(`身份归属：${attributionLine}`);
  }
  lines.push("如果要打已经发过言的人，改写成“我按这个缺口压票/挂观察/不直接归死”，不要写“你再解释、你补、你复述、轮到你回应”。");
  if (contract.voteBoundary) {
    lines.push(`今天处理查杀或投票的说法：${contract.voteBoundary}`);
  }
  lines.push(`输出仍然最多${contract.maxSentences}句、${contract.maxChars}字，只返回 {"speech":"..."}`);
  return lines;
}
