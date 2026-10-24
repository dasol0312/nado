// seed.sql 에서 자동 생성한 테스트용 데이터 (이름 대신 익명 ID)
import type { Place, Slot } from './matching';

export const NAMES: Record<string, string> = {
  "s_01": "Maya Chen",
  "s_02": "Diego Ramirez",
  "s_03": "Aisha Khan",
  "s_04": "Lucas Martin",
  "s_05": "Isabella Moreno",
  "s_06": "Jamal Carter",
  "s_07": "Kenji Watanabe",
  "s_08": "Ethan Brooks",
  "s_09": "Sofia Rossi",
  "s_10": "Hannah Kim",
  "s_11": "Olivia Nguyen",
  "s_12": "Priya Patel",
  "s_13": "Noah Fischer",
  "s_14": "Emma Johansson",
  "s_15": "Carlos Silva",
  "s_16": "Liam O'Brien",
  "s_17": "Zoe Dubois",
  "s_18": "Ryan Park",
  "s_19": "Tomás Garcia",
  "s_20": "Mina Lee",
  "s_21": "Grace Wu",
  "s_22": "Arjun Mehta",
  "s_23": "Oliver Smith",
  "s_24": "Fatima Ali"
};

export const PLACES: Place[] = [
  {
    "name": "Student Union lobby",
    "goodFor": [
      "boba",
      "coffee",
      "board games",
      "study"
    ]
  },
  {
    "name": "Boba Corner",
    "goodFor": [
      "boba",
      "dessert"
    ]
  },
  {
    "name": "Rec Center courts",
    "goodFor": [
      "basketball",
      "volleyball"
    ]
  },
  {
    "name": "Library front steps",
    "goodFor": [
      "study",
      "coffee"
    ]
  },
  {
    "name": "Main Quad fountain",
    "goodFor": [
      "hiking",
      "photography",
      "baseball"
    ]
  },
  {
    "name": "Campus Theater box office",
    "goodFor": [
      "musicals",
      "movies",
      "karaoke"
    ]
  }
];

export const SLOTS: Slot[] = [
  {"studentId": "s_01", "activity": "boba", "day": 0, "start": "14:00", "end": "18:00"},
  {"studentId": "s_01", "activity": "boba", "day": 6, "start": "14:00", "end": "18:00"},
  {"studentId": "s_01", "activity": "boba", "day": 1, "start": "15:00", "end": "17:00"},
  {"studentId": "s_01", "activity": "boba", "day": 2, "start": "15:00", "end": "17:00"},
  {"studentId": "s_01", "activity": "boba", "day": 3, "start": "15:00", "end": "17:00"},
  {"studentId": "s_01", "activity": "boba", "day": 4, "start": "15:00", "end": "17:00"},
  {"studentId": "s_01", "activity": "boba", "day": 5, "start": "15:00", "end": "17:00"},
  {"studentId": "s_02", "activity": "boba", "day": 0, "start": "13:00", "end": "17:00"},
  {"studentId": "s_02", "activity": "boba", "day": 6, "start": "13:00", "end": "17:00"},
  {"studentId": "s_02", "activity": "board games", "day": 5, "start": "19:00", "end": "22:00"},
  {"studentId": "s_03", "activity": "bubble tea", "day": 0, "start": "12:00", "end": "16:00"},
  {"studentId": "s_03", "activity": "bubble tea", "day": 3, "start": "12:00", "end": "16:00"},
  {"studentId": "s_04", "activity": "boba", "day": 0, "start": "15:00", "end": "19:00"},
  {"studentId": "s_04", "activity": "boba", "day": 6, "start": "15:00", "end": "19:00"},
  {"studentId": "s_04", "activity": "photography", "day": 6, "start": "09:00", "end": "12:00"},
  {"studentId": "s_05", "activity": "board games", "day": 5, "start": "19:00", "end": "23:00"},
  {"studentId": "s_05", "activity": "boba", "day": 0, "start": "13:00", "end": "16:00"},
  {"studentId": "s_06", "activity": "basketball", "day": 1, "start": "21:00", "end": "23:00"},
  {"studentId": "s_06", "activity": "basketball", "day": 3, "start": "21:00", "end": "23:00"},
  {"studentId": "s_06", "activity": "basketball", "day": 6, "start": "10:00", "end": "13:00"},
  {"studentId": "s_07", "activity": "basketball", "day": 1, "start": "20:00", "end": "22:00"},
  {"studentId": "s_07", "activity": "basketball", "day": 3, "start": "20:00", "end": "22:00"},
  {"studentId": "s_07", "activity": "ramen", "day": 5, "start": "19:00", "end": "21:00"},
  {"studentId": "s_08", "activity": "basketball", "day": 1, "start": "21:00", "end": "23:00"},
  {"studentId": "s_08", "activity": "basketball", "day": 3, "start": "21:00", "end": "23:00"},
  {"studentId": "s_08", "activity": "basketball", "day": 5, "start": "21:00", "end": "23:00"},
  {"studentId": "s_08", "activity": "ramen", "day": 5, "start": "20:00", "end": "22:00"},
  {"studentId": "s_09", "activity": "pickup basketball", "day": 3, "start": "20:00", "end": "22:00"},
  {"studentId": "s_09", "activity": "pickup basketball", "day": 6, "start": "10:00", "end": "12:00"},
  {"studentId": "s_09", "activity": "volleyball", "day": 2, "start": "18:00", "end": "20:00"},
  {"studentId": "s_10", "activity": "musicals", "day": 5, "start": "19:00", "end": "23:00"},
  {"studentId": "s_10", "activity": "musicals", "day": 6, "start": "19:00", "end": "23:00"},
  {"studentId": "s_10", "activity": "karaoke", "day": 4, "start": "20:00", "end": "23:00"},
  {"studentId": "s_11", "activity": "musicals", "day": 6, "start": "18:00", "end": "22:00"},
  {"studentId": "s_11", "activity": "musicals", "day": 0, "start": "13:00", "end": "17:00"},
  {"studentId": "s_12", "activity": "musicals", "day": 5, "start": "19:00", "end": "23:00"},
  {"studentId": "s_12", "activity": "musicals", "day": 0, "start": "13:00", "end": "17:00"},
  {"studentId": "s_12", "activity": "movies", "day": 2, "start": "19:00", "end": "22:00"},
  {"studentId": "s_13", "activity": "hiking", "day": 0, "start": "07:00", "end": "12:00"},
  {"studentId": "s_13", "activity": "hiking", "day": 6, "start": "07:00", "end": "12:00"},
  {"studentId": "s_13", "activity": "photography", "day": 0, "start": "07:00", "end": "10:00"},
  {"studentId": "s_14", "activity": "hiking", "day": 0, "start": "08:00", "end": "13:00"},
  {"studentId": "s_15", "activity": "hiking", "day": 0, "start": "06:00", "end": "10:00"},
  {"studentId": "s_15", "activity": "hiking", "day": 6, "start": "06:00", "end": "10:00"},
  {"studentId": "s_16", "activity": "study", "day": 1, "start": "10:00", "end": "13:00"},
  {"studentId": "s_16", "activity": "study", "day": 2, "start": "10:00", "end": "13:00"},
  {"studentId": "s_16", "activity": "study", "day": 3, "start": "10:00", "end": "13:00"},
  {"studentId": "s_16", "activity": "study", "day": 4, "start": "10:00", "end": "13:00"},
  {"studentId": "s_16", "activity": "study", "day": 5, "start": "10:00", "end": "13:00"},
  {"studentId": "s_16", "activity": "coffee", "day": 1, "start": "09:00", "end": "10:00"},
  {"studentId": "s_16", "activity": "coffee", "day": 2, "start": "09:00", "end": "10:00"},
  {"studentId": "s_16", "activity": "coffee", "day": 3, "start": "09:00", "end": "10:00"},
  {"studentId": "s_16", "activity": "coffee", "day": 4, "start": "09:00", "end": "10:00"},
  {"studentId": "s_16", "activity": "coffee", "day": 5, "start": "09:00", "end": "10:00"},
  {"studentId": "s_17", "activity": "study", "day": 1, "start": "11:00", "end": "14:00"},
  {"studentId": "s_17", "activity": "study", "day": 2, "start": "11:00", "end": "14:00"},
  {"studentId": "s_17", "activity": "study", "day": 3, "start": "11:00", "end": "14:00"},
  {"studentId": "s_17", "activity": "study", "day": 4, "start": "11:00", "end": "14:00"},
  {"studentId": "s_18", "activity": "baseball", "day": 5, "start": "18:00", "end": "22:00"},
  {"studentId": "s_18", "activity": "baseball", "day": 0, "start": "12:00", "end": "16:00"},
  {"studentId": "s_19", "activity": "baseball", "day": 0, "start": "12:00", "end": "17:00"},
  {"studentId": "s_20", "activity": "karaoke", "day": 4, "start": "20:00", "end": "23:00"},
  {"studentId": "s_20", "activity": "karaoke", "day": 6, "start": "20:00", "end": "23:00"},
  {"studentId": "s_20", "activity": "k-pop dance", "day": 2, "start": "19:00", "end": "21:00"},
  {"studentId": "s_21", "activity": "karaoke", "day": 4, "start": "20:00", "end": "23:00"},
  {"studentId": "s_21", "activity": "karaoke", "day": 6, "start": "20:00", "end": "23:00"},
  {"studentId": "s_22", "activity": "karaoke", "day": 6, "start": "20:00", "end": "23:00"},
  {"studentId": "s_22", "activity": "k-pop dance", "day": 2, "start": "19:00", "end": "21:00"},
  {"studentId": "s_23", "activity": "board games", "day": 5, "start": "19:00", "end": "23:00"},
  {"studentId": "s_23", "activity": "board games", "day": 0, "start": "14:00", "end": "18:00"},
  {"studentId": "s_24", "activity": "board games", "day": 5, "start": "18:00", "end": "21:00"}
];
