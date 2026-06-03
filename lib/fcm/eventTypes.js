/**
 * The 22 FCM event types (number -> name). Note there is no type 16; the
 * sequence jumps from 15 to 17, giving 22 buttons total.
 */
export const EVENT_TYPES = [
  { type: 0, name: 'StartBefore15Min' },
  { type: 1, name: 'Start1stHalf' },
  { type: 2, name: 'Start2ndHalf' },
  { type: 3, name: 'StartOvertime' },
  { type: 4, name: 'StartPenalty' },
  { type: 5, name: 'Lineup' },
  { type: 6, name: 'Corner' },
  { type: 7, name: 'Card' },
  { type: 8, name: 'Goal' },
  { type: 9, name: 'End1stHalf' },
  { type: 10, name: 'End2ndHalf' },
  { type: 11, name: 'EndOvertime' },
  { type: 12, name: 'Ended' },
  { type: 13, name: 'GoalScorer' },
  { type: 14, name: 'Highlights' },
  { type: 15, name: 'Penalty' },
  { type: 17, name: 'VAR' },
  { type: 18, name: 'CardPlayer' },
  { type: 19, name: 'PenaltyInGame' },
  { type: 20, name: 'MissPenaltyInGame' },
  { type: 21, name: 'Substitution' },
  { type: 22, name: 'BestLineups' },
]
