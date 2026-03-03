# Lean & Clean Coding Standard

1. **DRY & Unified**: 同一プロジェクト内に似たロジックを2つ作るな。共通化が正義。
2. **Resource First**: 計算量 O(n) を避けよ。Set/Mapを活用し、リソース消費を最小化せよ。
3. **No Bloat**: AIによる「コピペ的な肥大化」を禁ずる。1関数は原則30行以内。
4. **Immutability**: 予期せぬ副作用を防ぐため、可能な限り不変（Final/Read-only）を保て。
5. **Self-Documenting**: 名前で語れ。AIがコメントなしで理解できる構造が最高品質である。

