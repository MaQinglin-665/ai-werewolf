export function validatePlainSpeechFormatting(speech: string): string[] {
  if (/(?:\*\*|```|^>\s|\[[^\]]+\]\([^)]+\))/m.test(speech)) {
    return ["发言包含非对白Markdown格式"];
  }
  return [];
}

export function validateCompleteQuestionFragments(speech: string): string[] {
  const unfinishedQuestion = /(?:^|[。！？；])[^。！？；]{0,24}(?:为什么|凭什么|怎么)(?:验|查|出|打|认|站|压|跳|说|定|锁|拍)[^。！？；]{0,16}。/;
  const withoutQuotedQuestions = speech.replace(
    /[“‘"「『][^“”‘’"「」『』]{0,80}(?:为什么|凭什么|怎么)[^“”‘’"「」『』]{0,80}[”’"」』]/g,
    "",
  );
  return unfinishedQuestion.test(withoutQuotedQuestions) ? ["发言存在未完成的问题句"] : [];
}

export function countSentenceLikeUnits(speech: string): number {
  return speech.split(/[。！？；]/).filter((part) => part.trim().length > 0).length;
}
