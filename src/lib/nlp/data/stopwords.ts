/* English stop words + domain-specific resume/JD stop words.
 * Note: technical stop words that carry meaning (e.g. "r") are preserved. */

const ENGLISH_STOPWORDS = [
  "a","an","the","and","or","but","if","then","else","when","at","by","for",
  "with","about","against","between","into","through","during","before",
  "after","above","below","to","from","up","down","in","out","on","off",
  "over","under","again","further","once","here","there","all","any","both",
  "each","few","more","most","other","some","such","no","nor","not","only",
  "own","same","so","than","too","very","can","will","just","should","now",
  "is","am","are","was","were","be","been","being","have","has","had",
  "having","do","does","did","doing","would","could","shall","may","might",
  "must","of","as","it","its","this","that","these","those","i","you","he",
  "she","we","they","them","his","her","their","our","your","my","me","him",
  "us","who","whom","which","what","where","why","how","also","while",
];

const DOMAIN_STOPWORDS = [
  "etc","eg","ie","via","per","amp","responsible","responsibilities","duties",
  "including","include","includes","included","within","across","ensure",
  "ensuring","various","multiple","using","use","used","utilize","utilized",
  "leveraging","leverage","ability","strong","excellent","proven","track",
  "record","plus","required","requirements","preferred","qualifications",
  "ideal","candidate","role","position","job","description","join","company",
  "team","teams","work","working","worked","works","help","helping","new",
  "well","related","relevant","day","daily","years","year","months","month",
  "experience","experiences","experienced","skills","skill","knowledge",
  "understanding","familiarity","familiar","proficiency","proficient",
  "expertise","background","field","fields","opportunity","opportunities",
];

export const STOPWORDS: Set<string> = new Set([
  ...ENGLISH_STOPWORDS,
  ...DOMAIN_STOPWORDS,
]);
