export interface LoadingFact {
  category: string
  text: string
}

export const BASE_LOADING_FACTS: readonly LoadingFact[] = [
  // SOFTWARE / COMPUTING
  {
    category: 'SOFTWARE',
    text: 'Python was named after Monty Python, not the snake.',
  },
  {
    category: 'SOFTWARE',
    text: 'Git was created by Linus Torvalds in 2005 to help develop the Linux kernel.',
  },
  {
    category: 'WEB',
    text: 'Email existed before the World Wide Web.',
  },
  {
    category: 'WEB',
    text: 'The first website went online at CERN in 1991.',
  },
  {
    category: 'COMPUTING',
    text: 'The famous 1947 Harvard Mark II incident involved an actual moth found inside the machine.',
  },
  {
    category: 'COMPUTING',
    text: 'A byte is usually eight bits, which gives it 256 possible values.',
  },
  {
    category: 'COMPUTING',
    text: 'Modern GPUs began as graphics hardware but became exceptionally useful for parallel AI workloads.',
  },
  {
    category: 'INFRASTRUCTURE',
    text: 'Containers usually share the host operating-system kernel, unlike traditional virtual machines.',
  },
  {
    category: 'TECH HISTORY',
    text: 'Bluetooth is named after Harald “Bluetooth,” a 10th-century Danish king.',
  },
  {
    category: 'TECH HISTORY',
    text: 'QR codes were originally developed to track automotive parts during manufacturing.',
  },
  {
    category: 'AI',
    text: 'Artificial-neuron research dates back to at least the 1940s.',
  },
  {
    category: 'AI',
    text: 'A language model predicts tokens, not entire sentences at once.',
  },
  {
    category: 'AI',
    text: 'An embedding represents information as coordinates in a high-dimensional numerical space.',
  },
  {
    category: 'AI',
    text: 'Retrieval-augmented generation lets a model use information retrieved at query time instead of relying only on training.',
  },
  {
    category: 'AI',
    text: 'Computer vision systems ultimately work with numbers representing pixels, features, and learned patterns.',
  },

  // ENGINEERING / SPACE
  {
    category: 'ENGINEERING',
    text: "GPS would drift badly without corrections predicted by Einstein's relativity.",
  },
  {
    category: 'SPACE',
    text: 'Light from the Sun takes about eight minutes to reach Earth.',
  },
  {
    category: 'SPACE',
    text: 'A day on Venus is longer than a year on Venus.',
  },
  {
    category: 'SPACE',
    text: 'Footprints on the Moon can survive for extremely long periods because there is almost no wind or rain.',
  },
  {
    category: 'ENGINEERING',
    text: 'The Eiffel Tower can become several centimeters taller in hot weather because metal expands.',
  },

  // CHESS / GAMES
  {
    category: 'CHESS',
    text: 'A chessboard contains 64 squares but roughly 10^120 possible game sequences are often estimated.',
  },
  {
    category: 'CHESS',
    text: 'A knight is the only standard chess piece that can jump over other pieces.',
  },
  {
    category: 'GAMES',
    text: 'Video-game AI existed decades before modern machine learning became mainstream.',
  },
  {
    category: 'GAMES',
    text: 'Many game worlds only simulate expensive details when the player gets close enough to need them.',
  },

  // SCIENCE / STRANGE THINGS
  {
    category: 'SCIENCE',
    text: 'Octopuses have three hearts.',
  },
  {
    category: 'SCIENCE',
    text: 'Sharks existed millions of years before the first trees.',
  },
  {
    category: 'SCIENCE',
    text: 'Botanically, bananas are berries while strawberries are not true berries.',
  },
  {
    category: 'SCIENCE',
    text: 'Water can boil and freeze at the same time under the right pressure.',
  },
  {
    category: 'SCIENCE',
    text: 'Lightning can heat the surrounding air to temperatures hotter than the surface of the Sun.',
  },
  {
    category: 'SCIENCE',
    text: 'Your brain uses roughly the power of a small light bulb while performing extraordinary amounts of computation.',
  },
  {
    category: 'NATURE',
    text: "Honey's low moisture and acidity make it remarkably resistant to spoilage when stored properly.",
  },
  {
    category: 'NATURE',
    text: 'Crows can recognize individual human faces.',
  },
  {
    category: 'NATURE',
    text: 'Some fungi create underground networks extending across enormous areas.',
  },

  // BUILDING / CURIOSITY
  {
    category: 'BUILDER MODE',
    text: 'Most ambitious systems start as an embarrassingly small prototype.',
  },
  {
    category: 'BUILDER MODE',
    text: 'Debugging is often less about finding bad code and more about finding a wrong assumption.',
  },
  {
    category: 'BUILDER MODE',
    text: 'The fastest code is sometimes the code you realize you never needed to run.',
  },
  {
    category: 'BUILDER MODE',
    text: 'A working prototype teaches you things a perfect architecture diagram cannot.',
  },
  {
    category: 'BUILDER MODE',
    text: 'Good engineering is not only making something work. It is making failure understandable.',
  },
]

export const EASTER_EGG_FACTS: readonly LoadingFact[] = [
  {
    category: 'ABOUT THIS SITE',
    text: "The character you're looking at is rendered in real time in your browser.",
  },
  {
    category: 'ABOUT THIS SITE',
    text: 'The eyes on this character actually follow your cursor.',
  },
  {
    category: 'ABOUT THIS SITE',
    text: "The camera you're about to control is driven by your scroll position.",
  },
  {
    category: 'ABOUT THIS SITE',
    text: "There are interactive stories hidden in the character's watch and shoes.",
  },
  {
    category: 'ABOUT THIS SITE',
    text: 'The stickers on the character correspond to projects and engineering interests.',
  },
  {
    category: 'ABOUT THIS SITE',
    text: 'This portfolio uses a GLB model rendered with Three.js and React Three Fiber.',
  },
  {
    category: 'ABOUT THIS SITE',
    text: 'Yes, the G-Shock has lore.',
  },
]

export const LOADING_FACTS: readonly LoadingFact[] = [
  ...BASE_LOADING_FACTS,
  ...EASTER_EGG_FACTS,
]

/**
 * Creates a freshly shuffled bag using Fisher-Yates shuffle.
 * Guarantees the first item of a new bag is not identical to the last item of the previous bag.
 */
export function createShuffledBag<T extends { text: string }>(
  items: readonly T[],
  prevLastItem?: T
): T[] {
  const bag = [...items]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]]
  }
  if (prevLastItem && bag.length > 1 && bag[0].text === prevLastItem.text) {
    const swapIdx = Math.floor(Math.random() * (bag.length - 1)) + 1;
    [bag[0], bag[swapIdx]] = [bag[swapIdx], bag[0]]
  }
  return bag
}
