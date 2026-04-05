from app.modules.test.service import calculate_irt_score


def test_irt_score_handles_extreme_patterns():
    assert calculate_irt_score([]) == 0.0
    assert calculate_irt_score([(1, 1), (3, 1), (5, 1)]) == 60.0
    assert calculate_irt_score([(1, 0), (3, 0), (5, 0)]) == 0.0


def test_irt_score_rewards_harder_correct_answers():
    easier = calculate_irt_score([(1, 1), (1, 1), (5, 0), (5, 0)])
    harder = calculate_irt_score([(1, 0), (1, 0), (5, 1), (5, 1)])

    assert harder > easier
    assert 0.0 <= easier <= 60.0
    assert 0.0 <= harder <= 60.0
