// 진짜 Claude로 기능 3개 시험 (API 키 필요)
//   npx tsx --env-file=.env.local lib/nado/try-features.ts                  관심사 + 아이스브레이커
//   npx tsx --env-file=.env.local lib/nado/try-features.ts ~/albert.png     + Albert 캡처 읽기
import { readFileSync } from "node:fs";
import { icebreaker, readAlbert, thinkInterest } from "./features";

const CATEGORIES = ["Sports", "Cafe", "Study", "Food", "Culture", "Games", "Other"];

async function main() {
  for (const name of ["badminton", "boba, Koreans only", "escape room"]) {
    console.log(`\n[interest] ${name}`);
    console.log(await thinkInterest(name, CATEGORIES));
  }
  console.log("\n[icebreaker] boba");
  console.log(await icebreaker({ people: 4, label: "Boba", previous: "What's your go-to boba order, sugar and ice level included?" }));

  const image = process.argv[2];
  if (image) {
    const ext = image.split(".").pop()?.toLowerCase();
    const mediaType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    console.log(`\n[albert] ${image}`);
    console.log(await readAlbert({ data: readFileSync(image).toString("base64"), mediaType }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
